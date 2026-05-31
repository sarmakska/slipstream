/**
 * A minimal MCP server over JSON-RPC 2.0, framed by newline-delimited JSON on
 * stdio. claudepilot ships this rather than pulling in the full MCP SDK for one
 * reason: a plugin that bundles a server should add as little to a user's
 * install as possible, and the slice of the protocol Claude Code drives is
 * small and stable (initialize, tools/list, tools/call). Implementing it
 * directly keeps the dependency surface at zero and the server auditable in one
 * file. See Design decisions in the wiki for why I did not depend on the SDK.
 *
 * The request handler is pure and exported on its own so tests can drive it
 * without a process: feed it a request object, assert on the response. The
 * transport loop below is the only impure part.
 */

import { callTool, TOOL_DESCRIPTORS, type ToolContext } from "./tools.js";

export const PROTOCOL_VERSION = "2024-11-05";
export const SERVER_NAME = "claudepilot";
export const SERVER_VERSION = "0.2.0";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

function ok(id: JsonRpcRequest["id"], result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function fail(
  id: JsonRpcRequest["id"],
  code: number,
  message: string
): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/**
 * Handle one JSON-RPC request and produce a response, or null for a
 * notification (a request with no id, which must not be answered). This is the
 * whole protocol surface claudepilot implements.
 */
export async function handleRequest(
  req: JsonRpcRequest,
  ctx: ToolContext
): Promise<JsonRpcResponse | null> {
  switch (req.method) {
    case "initialize":
      return ok(req.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
      });

    case "notifications/initialized":
      return null; // notification, no response

    case "ping":
      return ok(req.id, {});

    case "tools/list":
      return ok(req.id, { tools: TOOL_DESCRIPTORS });

    case "tools/call": {
      const params = req.params ?? {};
      const name = params["name"];
      if (typeof name !== "string") {
        return fail(req.id, INVALID_PARAMS, "tools/call requires a string name");
      }
      const args = (params["arguments"] as Record<string, unknown>) ?? {};
      const result = await callTool(name, args, ctx);
      return ok(req.id, result);
    }

    default:
      // A notification we do not handle: stay silent. A request: report it.
      if (req.id === undefined || req.id === null) return null;
      return fail(req.id, METHOD_NOT_FOUND, `method not found: ${req.method}`);
  }
}

/**
 * Run the stdio transport: read newline-delimited JSON-RPC requests from stdin,
 * dispatch each, and write newline-delimited responses to stdout. Never writes
 * anything but framed responses to stdout, because the host parses it; logging
 * goes to stderr only.
 */
export async function runStdioServer(ctx: ToolContext): Promise<void> {
  let buffer = "";
  process.stdin.setEncoding("utf8");

  const flush = async (): Promise<void> => {
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;
      let req: JsonRpcRequest;
      try {
        req = JSON.parse(line) as JsonRpcRequest;
      } catch {
        continue; // a malformed line cannot have an id to answer to
      }
      try {
        const res = await handleRequest(req, ctx);
        if (res) process.stdout.write(JSON.stringify(res) + "\n");
      } catch (error) {
        process.stdout.write(
          JSON.stringify(fail(req.id ?? null, -32603, (error as Error).message)) + "\n"
        );
      }
    }
  };

  for await (const chunk of process.stdin) {
    buffer += chunk;
    await flush();
  }
}

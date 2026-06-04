/**
 * A minimal MCP server over JSON-RPC 2.0, framed by newline-delimited JSON on
 * stdio. slipstream ships this rather than pulling in the full MCP SDK for one
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

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { callTool, TOOL_DESCRIPTORS, type ToolContext } from "./tools.js";
import { appendEvent } from "../dashboard/log.js";
import { makeEvent } from "../dashboard/events.js";
import { startDashboard } from "../dashboard/launch.js";
import { detectMode, shouldEmit, shouldStartDashboard } from "./mode-detect.js";
import { listSkillPrompts, getSkillPrompt } from "./prompts.js";

export const PROTOCOL_VERSION = "2024-11-05";
export const SERVER_NAME = "slipstream";

// Single source of truth: read the version from package.json so the value the
// MCP `initialize` handshake reports can never drift from the published package.
// Both src/mcp/server.ts and dist/mcp/server.js sit two levels under the root.
function readPackageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(
      readFileSync(join(here, "..", "..", "package.json"), "utf8")
    ) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const SERVER_VERSION = readPackageVersion();

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
 * whole protocol surface slipstream implements.
 */
export async function handleRequest(
  req: JsonRpcRequest,
  ctx: ToolContext
): Promise<JsonRpcResponse | null> {
  switch (req.method) {
    case "initialize":
      return ok(req.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          prompts: { listChanged: false }
        },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
      });

    case "notifications/initialized":
      return null; // notification, no response

    case "ping":
      return ok(req.id, {});

    case "tools/list":
      return ok(req.id, { tools: TOOL_DESCRIPTORS });

    case "prompts/list": {
      const prompts = await listSkillPrompts();
      return ok(req.id, {
        prompts: prompts.map((p) => ({ name: p.name, description: p.description }))
      });
    }

    case "prompts/get": {
      const params = req.params ?? {};
      const name = params["name"];
      if (typeof name !== "string") {
        return fail(req.id, INVALID_PARAMS, "prompts/get requires a string name");
      }
      const detail = await getSkillPrompt(name);
      if (!detail) {
        return fail(req.id, INVALID_PARAMS, `unknown prompt: ${name}`);
      }
      return ok(req.id, {
        description: detail.description,
        messages: [
          {
            role: "user",
            content: { type: "text", text: detail.content }
          }
        ]
      });
    }

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
 * Derive a session id for an MCP connection from the client that connected. In
 * editors other than Claude Code there are no lifecycle hooks, so the MCP server
 * is the only thing that can name a session; we build a stable, readable id from
 * the client name plus a short time suffix so each editor session is distinct in
 * the dashboard picker.
 */
export function sessionFromClient(params: Record<string, unknown> | undefined): string {
  const info = params?.["clientInfo"] as { name?: string } | undefined;
  const raw = (info?.name ?? "mcp").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const suffix = Date.now().toString(36).slice(-5);
  return `${raw || "mcp"}-${suffix}`;
}

/** Pull the most informative argument from a tools/call for the activity label. */
function callTarget(args: Record<string, unknown>): string {
  for (const key of ["file", "symbol", "query", "around", "fact", "name"]) {
    const v = args[key];
    if (typeof v === "string" && v) return v;
  }
  return "";
}

/**
 * Phase 1 of cross-IDE support: the server feeds the dashboard itself. After a
 * tools/call it appends a post-tool event to the same append-only log the hooks
 * write, so in Cursor, Windsurf, Antigravity or any MCP client the live dashboard
 * fills with activity even though those editors expose no hooks. Inside Claude
 * Code the PostToolUse hook already emits, so the plugin sets SLIPSTREAM_MCP_EMIT=0
 * to keep this quiet and avoid double-counting. Emission is fire-and-forget and
 * never affects the response.
 */
async function emitToolEvent(
  root: string,
  session: string,
  params: Record<string, unknown>,
  result: unknown,
  emit: boolean
): Promise<void> {
  if (!emit) return;
  const name = typeof params["name"] === "string" ? (params["name"] as string) : "tool";
  const args = (params["arguments"] as Record<string, unknown>) ?? {};
  const target = callTarget(args);
  const content = (result as { content?: Array<{ text?: string }> })?.content;
  const text = content?.[0]?.text ?? "";
  const bytes = Buffer.byteLength(text, "utf8");
  await appendEvent(
    root,
    makeEvent({
      session,
      agent: "main",
      kind: "post-tool",
      label: `${name} ${target}`.trim(),
      data: { bytes, source: "mcp" }
    })
  );
}

/**
 * Run the stdio transport: read newline-delimited JSON-RPC requests from stdin,
 * dispatch each, and write newline-delimited responses to stdout. Never writes
 * anything but framed responses to stdout, because the host parses it; logging
 * goes to stderr only.
 */
export async function runStdioServer(ctx: ToolContext): Promise<void> {
  let buffer = "";
  let session = "mcp";
  process.stdin.setEncoding("utf8");

  // Decide once at startup: are we a Claude Code plugin (passive) or a
  // standalone MCP server for another editor (active, self-emitting)? The
  // detected mode controls emission and dashboard auto-start; explicit env
  // vars still override.
  const detected = detectMode({ env: process.env, cwd: ctx.defaultRoot });
  const emitEnabled = shouldEmit(process.env, detected.mode);
  const dashboardEnabled = shouldStartDashboard(process.env, detected.mode);

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
        if (req.method === "initialize") {
          session = sessionFromClient(req.params);
          // Record the session opening so the dashboard lists it immediately.
          if (emitEnabled) {
            appendEvent(
              ctx.defaultRoot,
              makeEvent({ session, agent: "main", kind: "session-start", label: `mcp session: ${session} (${detected.reason})` })
            ).catch(() => {});
          }
          // Zero-setup dashboard. In editors without Claude Code's hooks the
          // MCP server brings the dashboard up itself (detached, idempotent),
          // so opening the editor is all it takes. In plugin mode the
          // SessionStart hook already does this so we stay quiet.
          if (dashboardEnabled) {
            startDashboard({ projectRoot: ctx.defaultRoot, session, detached: true }).catch(() => {});
          }
        }
        const res = await handleRequest(req, ctx);
        if (res) process.stdout.write(JSON.stringify(res) + "\n");
        if (req.method === "tools/call" && res && !res.error) {
          emitToolEvent(ctx.defaultRoot, session, req.params ?? {}, res.result, emitEnabled).catch(() => {});
        }
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

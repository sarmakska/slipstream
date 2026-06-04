import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import {
  handleRequest,
  TOOL_DESCRIPTORS,
  callTool,
  type JsonRpcRequest
} from "../src/mcp/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const sample = join(here, "..", "fixtures", "sample-project");
const ctx = { defaultRoot: sample };

describe("mcp request handler", () => {
  it("reports server info on initialize", async () => {
    const res = await handleRequest(
      { jsonrpc: "2.0", id: 1, method: "initialize" } as JsonRpcRequest,
      ctx
    );
    expect(res?.result).toMatchObject({
      serverInfo: { name: "slipstream" }
    });
  });

  it("lists every sp_ tool", async () => {
    const res = await handleRequest(
      { jsonrpc: "2.0", id: 2, method: "tools/list" } as JsonRpcRequest,
      ctx
    );
    const tools = (res?.result as { tools: Array<{ name: string }> }).tools;
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "sp_budget",
      "sp_dashboard",
      "sp_forget",
      "sp_lessons",
      "sp_lines",
      "sp_map",
      "sp_mindmap",
      "sp_observations",
      "sp_recall",
      "sp_remember",
      "sp_savings",
      "sp_search",
      "sp_search_memory",
      "sp_symbol",
      "sp_timeline"
    ]);
    // Every description is a crisp "Use ..." trigger.
    for (const t of tools) expect(t.description.startsWith("Use")).toBe(true);
  });

  it("answers a notification with null (no response)", async () => {
    const res = await handleRequest(
      { jsonrpc: "2.0", method: "notifications/initialized" } as JsonRpcRequest,
      ctx
    );
    expect(res).toBeNull();
  });

  it("reports method not found for an unknown request", async () => {
    const res = await handleRequest(
      { jsonrpc: "2.0", id: 9, method: "does/not/exist" } as JsonRpcRequest,
      ctx
    );
    expect(res?.error?.code).toBe(-32601);
  });
});

describe("sp_symbol returns a scoped slice, not the whole file", () => {
  it("returns just the requested symbol", async () => {
    const result = await callTool(
      "sp_symbol",
      { file: "src/greet.ts", symbol: "greet" },
      ctx
    );
    const out = result.content[0]?.text ?? "";
    expect(out).toContain("export function greet");
    expect(out).not.toContain("DEFAULT_GREETING");
    // The slice must be smaller than the file it came from.
    const whole = await readFile(join(sample, "src/greet.ts"), "utf8");
    expect(out.length).toBeLessThan(whole.length);
  });

  it("errors cleanly for an unknown symbol", async () => {
    const result = await callTool(
      "sp_symbol",
      { file: "src/greet.ts", symbol: "nope" },
      ctx
    );
    expect(result.isError).toBe(true);
  });
});

describe("sp_map and sp_search never embed file contents", () => {
  it("sp_map returns the index without source bodies", async () => {
    const result = await callTool("sp_map", {}, ctx);
    const out = result.content[0]?.text ?? "";
    expect(out).toContain("# Project map");
    expect(out).not.toContain("return `hello");
  });

  it("sp_search returns locations not bodies", async () => {
    const result = await callTool("sp_search", { query: "greet" }, ctx);
    const out = result.content[0]?.text ?? "";
    expect(out).toContain("src/greet.ts");
    expect(out).not.toContain("return `hello");
  });
});

describe("the bundled server runs over real stdio", () => {
  it("spawns, answers tools/list and a sp_symbol call", async () => {
    const entry = join(here, "..", "dist", "mcp", "index.js");
    const child = spawn(process.execPath, [entry], {
      cwd: sample,
      stdio: ["pipe", "pipe", "pipe"],
      // Keep the test hermetic: no event emission into the fixture, no dashboard spawn.
      env: { ...process.env, SLIPSTREAM_MCP_EMIT: "0", SLIPSTREAM_DASHBOARD: "0" }
    });

    const responses: Record<string, unknown>[] = [];
    let buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
        if (line) responses.push(JSON.parse(line));
      }
    });

    const send = (obj: unknown): void => {
      child.stdin.write(JSON.stringify(obj) + "\n");
    };
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "sp_symbol", arguments: { file: "src/greet.ts", symbol: "greet" } }
    });

    // Wait until the three responses have arrived, then close stdin.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("mcp server timed out")), 8000);
      const poll = setInterval(() => {
        if (responses.length >= 3) {
          clearInterval(poll);
          clearTimeout(timer);
          child.stdin.end();
          resolve();
        }
      }, 25);
    });
    child.kill();

    const list = responses.find((r) => r["id"] === 2);
    const tools = (list?.["result"] as { tools: Array<{ name: string }> }).tools;
    expect(tools.length).toBe(TOOL_DESCRIPTORS.length);
    expect(tools.some((t) => t.name === "sp_symbol")).toBe(true);

    const call = responses.find((r) => r["id"] === 3);
    const text = (call?.["result"] as { content: Array<{ text: string }> }).content[0]?.text ?? "";
    expect(text).toContain("export function greet");
    expect(text).not.toContain("DEFAULT_GREETING");
  });
});

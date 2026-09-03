import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCodexRollout, SOURCES, sourceById, isInjectedContext } from "../src/memory/sources.js";
import { harvest, isUnchanged, harvestedSession } from "../src/memory/harvest.js";
import type { SourceFile, ChatSource } from "../src/memory/sources.js";

// One real-shaped Codex rollout. Line types and payload shapes match what the
// CLI actually writes: session_meta, then response_items carrying messages,
// function calls and reasoning.
const CODEX_ROLLOUT = [
  JSON.stringify({
    timestamp: "2026-06-01T15:28:36.990Z",
    type: "session_meta",
    payload: { id: "019e83cd", cwd: "D:\\", originator: "Codex Desktop", cli_version: "0.135.0" },
  }),
  JSON.stringify({
    timestamp: "2026-06-01T15:28:40.000Z",
    type: "response_item",
    payload: { type: "message", role: "developer", content: [{ type: "input_text", text: "<permissions instructions>" }] },
  }),
  JSON.stringify({
    timestamp: "2026-06-01T15:29:00.000Z",
    type: "response_item",
    payload: { type: "message", role: "user", content: [{ type: "input_text", text: "why is the build failing?" }] },
  }),
  JSON.stringify({
    timestamp: "2026-06-01T15:29:05.000Z",
    type: "response_item",
    payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "Checking the config." }] },
  }),
  JSON.stringify({
    timestamp: "2026-06-01T15:29:06.000Z",
    type: "response_item",
    payload: { type: "function_call", name: "exec_command" },
  }),
  JSON.stringify({
    timestamp: "2026-06-01T15:29:07.000Z",
    type: "response_item",
    payload: { type: "function_call_output", output: "tsc: ok" },
  }),
  JSON.stringify({
    timestamp: "2026-06-01T15:29:08.000Z",
    type: "response_item",
    payload: { type: "reasoning", summary: [] },
  }),
  JSON.stringify({
    timestamp: "2026-06-01T15:29:09.000Z",
    type: "response_item",
    payload: { type: "custom_tool_call", name: "apply_patch" },
  }),
].join("\n");

describe("parseCodexRollout", () => {
  it("keeps user and assistant messages and drops the injected developer prompt", () => {
    const turns = parseCodexRollout(CODEX_ROLLOUT);
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant"]);
    expect(turns[0].text).toBe("why is the build failing?");
    expect(turns[1].text).toBe("Checking the config.");
  });

  it("folds tool calls onto the assistant turn they follow", () => {
    const turns = parseCodexRollout(CODEX_ROLLOUT);
    expect(turns[1].tools).toEqual(["exec_command", "apply_patch"]);
  });

  it("carries timestamps through", () => {
    expect(parseCodexRollout(CODEX_ROLLOUT)[0].ts).toBe("2026-06-01T15:29:00.000Z");
  });

  it("survives malformed lines rather than throwing", () => {
    const turns = parseCodexRollout(`not json\n\n${CODEX_ROLLOUT}\n{"partial":`);
    expect(turns).toHaveLength(2);
  });

  it("returns nothing for an empty transcript", () => {
    expect(parseCodexRollout("")).toEqual([]);
  });

  it("ignores a tool call with no assistant turn to attribute it to", () => {
    const orphan = JSON.stringify({
      type: "response_item",
      payload: { type: "function_call", name: "exec_command" },
    });
    expect(parseCodexRollout(orphan)).toEqual([]);
  });
});

describe("isInjectedContext", () => {
  it("drops a whole injected block", () => {
    expect(isInjectedContext("<environment_context>\n  <cwd>D:</cwd>\n</environment_context>")).toBe(true);
    expect(isInjectedContext("<user_instructions>be terse</user_instructions>")).toBe(true);
  });

  it("keeps a real question that merely mentions one", () => {
    expect(isInjectedContext("why is <environment_context> showing the wrong cwd?")).toBe(false);
    expect(isInjectedContext("<environment_context> got truncated, any idea?")).toBe(false);
  });

  it("keeps ordinary prose", () => {
    expect(isInjectedContext("why is the build failing?")).toBe(false);
  });
});

describe("source registry", () => {
  it("exposes claude-code and codex", () => {
    expect(SOURCES.map((s) => s.id).sort()).toEqual(["claude-code", "codex"]);
  });

  it("looks a source up by id", () => {
    expect(sourceById("codex")?.label).toBe("Codex CLI");
    expect(sourceById("antigravity")).toBeUndefined();
  });
});

describe("isUnchanged", () => {
  const file: SourceFile = { path: "/a.jsonl", session: "a", mtimeMs: 100, size: 10 };

  it("is false when the file has never been seen", () => {
    expect(isUnchanged({}, file)).toBe(false);
  });

  it("is true only when both mtime and size match", () => {
    const at = "2026-06-01T00:00:00.000Z";
    expect(isUnchanged({ "/a.jsonl": { mtimeMs: 100, size: 10, at } }, file)).toBe(true);
    expect(isUnchanged({ "/a.jsonl": { mtimeMs: 101, size: 10, at } }, file)).toBe(false);
    // A live transcript being appended to keeps its mtime granularity but grows.
    expect(isUnchanged({ "/a.jsonl": { mtimeMs: 100, size: 11, at } }, file)).toBe(false);
  });
});

describe("harvestedSession", () => {
  const file: SourceFile = { path: "/a.jsonl", session: "abc", mtimeMs: 1, size: 1 };

  it("leaves Claude Code ids alone so existing conversations keep their name", () => {
    expect(harvestedSession(sourceById("claude-code")!, file)).toBe("abc");
  });

  it("namespaces other clients so two sources cannot collide", () => {
    expect(harvestedSession(sourceById("codex")!, file)).toBe("codex--abc");
  });
});

describe("harvest", () => {
  let root: string;
  let home: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "slipstream-harvest-"));
    home = await mkdtemp(join(tmpdir(), "slipstream-fakehome-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });

  /** A source pointed at a temp dir, so the test never reads the real machine. */
  async function fakeSource(id: string, raw: string): Promise<ChatSource> {
    const dir = join(home, id);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "rollout-019e83cd.jsonl");
    await writeFile(path, raw, "utf8");
    const { stat } = await import("node:fs/promises");
    const info = await stat(path);
    return {
      id,
      label: id,
      root: dir,
      discover: async () => [{ path, session: "019e83cd", mtimeMs: info.mtimeMs, size: info.size }],
      parse: parseCodexRollout,
    };
  }

  it("folds a conversation and records it as unchanged next run", async () => {
    const source = await fakeSource("codex", CODEX_ROLLOUT);
    {
      const first = await harvest({ root, only: ["codex"] , sources: [source] });
      expect(first.taken).toHaveLength(1);
      expect(first.taken[0].exchanges).toBe(1);

      const stored = JSON.parse(
        await readFile(join(root, ".claude", "slipstream", "conversations", "codex--019e83cd.json"), "utf8")
      );
      expect(stored.source).toBe("codex");
      expect(stored.exchanges[0].ask).toBe("why is the build failing?");
      expect(stored.exchanges[0].tools).toEqual(["exec_command", "apply_patch"]);

      const second = await harvest({ root, only: ["codex"] , sources: [source] });
      expect(second.taken).toHaveLength(0);
      expect(second.unchanged).toBe(1);
    }
  });

  it("writes nothing on a dry run", async () => {
    const source = await fakeSource("codex", CODEX_ROLLOUT);
    {
      const report = await harvest({ root, only: ["codex"], dryRun: true , sources: [source] });
      expect(report.dryRun).toBe(true);
      expect(report.taken).toHaveLength(1);
      // State was not written, so a real run still has work to do.
      const after = await harvest({ root, only: ["codex"], dryRun: true , sources: [source] });
      expect(after.taken).toHaveLength(1);
    }
  });

  it("counts a transcript with no conversation as skipped, not taken", async () => {
    const source = await fakeSource("codex", "not json\n");
    {
      const report = await harvest({ root, only: ["codex"] , sources: [source] });
      expect(report.taken).toHaveLength(0);
      expect(report.skipped).toBe(1);
    }
  });
});

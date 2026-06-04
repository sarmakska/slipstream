import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectEditor,
  detectDoubleWire,
  buildClaudeSettings,
  buildEditorMcpConfig,
  parseSetupArgs,
  runSetup
} from "../src/cli/setup.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "slipstream-setup-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("detectEditor", () => {
  it("picks claude-code when .claude exists", () => {
    mkdirSync(join(tmp, ".claude"), { recursive: true });
    expect(detectEditor(tmp)).toBe("claude-code");
  });
  it("picks cursor when .cursor exists and no .claude", () => {
    mkdirSync(join(tmp, ".cursor"));
    expect(detectEditor(tmp)).toBe("cursor");
  });
  it("picks windsurf, antigravity or vscode in that fallback order", () => {
    mkdirSync(join(tmp, ".windsurf"));
    expect(detectEditor(tmp)).toBe("windsurf");
    rmSync(join(tmp, ".windsurf"), { recursive: true });
    mkdirSync(join(tmp, ".antigravity"));
    expect(detectEditor(tmp)).toBe("antigravity");
    rmSync(join(tmp, ".antigravity"), { recursive: true });
    mkdirSync(join(tmp, ".vscode"));
    expect(detectEditor(tmp)).toBe("vscode");
  });
  it("returns null when nothing matches", () => {
    expect(detectEditor(tmp)).toBeNull();
  });
});

describe("buildClaudeSettings", () => {
  it("creates the slipstream block when no prior settings exist", () => {
    const next = buildClaudeSettings(null);
    expect(next["statusLine"]).toBeDefined();
    expect(next["skills"]).toBeDefined();
    expect(next["hooks"]).toBeDefined();
    expect((next["mcpServers"] as Record<string, unknown>)["slipstream"]).toBeDefined();
  });
  it("preserves user-owned keys when merging", () => {
    const prev = { theme: "dark", mcpServers: { other: { command: "x" } } } as Record<string, unknown>;
    const next = buildClaudeSettings(prev);
    expect(next["theme"]).toBe("dark");
    const servers = next["mcpServers"] as Record<string, unknown>;
    expect(servers["other"]).toBeDefined();
    expect(servers["slipstream"]).toBeDefined();
  });
  it("is idempotent: running twice produces the same shape", () => {
    const a = buildClaudeSettings(null);
    const b = buildClaudeSettings(a);
    expect(JSON.stringify(a["mcpServers"])).toBe(JSON.stringify(b["mcpServers"]));
  });
});

describe("buildEditorMcpConfig", () => {
  it("adds the slipstream entry on a clean file", () => {
    const next = buildEditorMcpConfig(null);
    const servers = next["mcpServers"] as Record<string, unknown>;
    expect(servers["slipstream"]).toBeDefined();
  });
  it("does not duplicate when an entry already exists", () => {
    const a = buildEditorMcpConfig(null);
    const b = buildEditorMcpConfig(a);
    const sa = a["mcpServers"] as Record<string, unknown>;
    const sb = b["mcpServers"] as Record<string, unknown>;
    expect(Object.keys(sa)).toEqual(Object.keys(sb));
  });
});

describe("parseSetupArgs", () => {
  it("defaults to auto + no dry-run", () => {
    const opts = parseSetupArgs([], tmp);
    expect(opts.editor).toBe("auto");
    expect(opts.dryRun).toBe(false);
  });
  it("parses --editor and --dry-run", () => {
    const opts = parseSetupArgs(["--editor=cursor", "--dry-run"], tmp);
    expect(opts.editor).toBe("cursor");
    expect(opts.dryRun).toBe(true);
  });
});

describe("runSetup for each editor", () => {
  it("writes .claude/settings.local.json for claude-code", async () => {
    const result = await runSetup({ cwd: tmp, editor: "claude-code", dryRun: false });
    expect(result.exitCode).toBe(0);
    const path = join(tmp, ".claude", "settings.local.json");
    expect(existsSync(path)).toBe(true);
    const parsed = JSON.parse(await readFile(path, "utf8"));
    expect(parsed.mcpServers.slipstream).toBeDefined();
  });

  it("writes .cursor/mcp.json for cursor", async () => {
    await runSetup({ cwd: tmp, editor: "cursor", dryRun: false });
    const path = join(tmp, ".cursor", "mcp.json");
    expect(existsSync(path)).toBe(true);
    const parsed = JSON.parse(await readFile(path, "utf8"));
    expect(parsed.mcpServers.slipstream).toBeDefined();
  });

  it("writes .windsurf/mcp.json for windsurf", async () => {
    await runSetup({ cwd: tmp, editor: "windsurf", dryRun: false });
    expect(existsSync(join(tmp, ".windsurf", "mcp.json"))).toBe(true);
  });

  it("writes .antigravity/mcp.json for antigravity", async () => {
    await runSetup({ cwd: tmp, editor: "antigravity", dryRun: false });
    expect(existsSync(join(tmp, ".antigravity", "mcp.json"))).toBe(true);
  });

  it("writes .vscode/mcp.json for vscode", async () => {
    await runSetup({ cwd: tmp, editor: "vscode", dryRun: false });
    expect(existsSync(join(tmp, ".vscode", "mcp.json"))).toBe(true);
  });

  it("is idempotent: running twice leaves one slipstream entry", async () => {
    await runSetup({ cwd: tmp, editor: "cursor", dryRun: false });
    await runSetup({ cwd: tmp, editor: "cursor", dryRun: false });
    const parsed = JSON.parse(await readFile(join(tmp, ".cursor", "mcp.json"), "utf8"));
    expect(Object.keys(parsed.mcpServers).filter((k) => k.includes("slipstream"))).toEqual(["slipstream"]);
  });

  it("auto-detect picks claude-code when .claude exists", async () => {
    mkdirSync(join(tmp, ".claude"), { recursive: true });
    const result = await runSetup({ cwd: tmp, editor: "auto", dryRun: false });
    expect(result.editor).toBe("claude-code");
  });

  it("dry-run writes no files but reports the plan", async () => {
    const result = await runSetup({ cwd: tmp, editor: "cursor", dryRun: true });
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(tmp, ".cursor", "mcp.json"))).toBe(false);
    expect(result.changes.length).toBe(1);
    expect(result.notes.some((n) => n.includes("dry-run"))).toBe(true);
  });

  it("refuses to double-wire when plugin mode and .mcp.json both have slipstream", async () => {
    mkdirSync(join(tmp, ".claude", "hooks"), { recursive: true });
    await writeFile(
      join(tmp, ".mcp.json"),
      JSON.stringify({ mcpServers: { slipstream: { command: "x" } } }),
      "utf8"
    );
    const result = await runSetup({ cwd: tmp, editor: "claude-code", dryRun: false });
    expect(result.exitCode).toBe(2);
    expect(result.notes.join("\n")).toMatch(/double-wire/);
  });
});

describe("detectDoubleWire", () => {
  it("is false when only one side is present", () => {
    expect(detectDoubleWire(tmp)).toBe(false);
    mkdirSync(join(tmp, ".claude", "hooks"), { recursive: true });
    expect(detectDoubleWire(tmp)).toBe(false);
  });
});

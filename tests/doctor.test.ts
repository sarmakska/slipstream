import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runDoctor, renderDoctor } from "../src/doctor/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(here, "..");

describe("runDoctor against the real plugin tree", () => {
  it("passes every check on the built plugin", async () => {
    const report = await runDoctor(pluginRoot, pluginRoot);
    const failed = report.checks.filter((c) => !c.pass).map((c) => c.id);
    expect(failed).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("verifies the MCP server, PreCompact hook and subagents are wired", async () => {
    const report = await runDoctor(pluginRoot, pluginRoot);
    const ids = new Set(report.checks.map((c) => c.id));
    expect(ids.has("mcp-declared")).toBe(true);
    expect(ids.has("precompact-hook")).toBe(true);
    expect(ids.has("subagents")).toBe(true);
    expect(ids.has("statusline")).toBe(true);
    expect(ids.has("output-style")).toBe(true);
  });

  it("renders a pass/fail report", async () => {
    const report = await runDoctor(pluginRoot, pluginRoot);
    const rendered = renderDoctor(report);
    expect(rendered).toContain("# slipstream doctor");
    expect(rendered).toMatch(/PASS\s+mcp-declared/);
  });
});

describe("runDoctor fails loudly on a broken install", () => {
  let broken: string;
  beforeEach(async () => {
    broken = await mkdtemp(join(tmpdir(), "slipstream-doctor-"));
    // A plugin tree missing dist, the MCP declaration and the PreCompact hook.
    await mkdir(join(broken, ".claude-plugin"), { recursive: true });
    await writeFile(
      join(broken, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "slipstream", version: "0.0.0" }),
      "utf8"
    );
    await mkdir(join(broken, "hooks"), { recursive: true });
    await writeFile(
      join(broken, "hooks", "hooks.json"),
      JSON.stringify({ hooks: {} }),
      "utf8"
    );
  });
  afterEach(async () => {
    await rm(broken, { recursive: true, force: true });
  });

  it("reports FAIL for the missing pieces", async () => {
    const report = await runDoctor(broken, broken);
    expect(report.ok).toBe(false);
    const failed = new Set(report.checks.filter((c) => !c.pass).map((c) => c.id));
    expect(failed.has("mcp-build")).toBe(true);
    expect(failed.has("mcp-declared")).toBe(true);
    expect(failed.has("precompact-hook")).toBe(true);
  });
});
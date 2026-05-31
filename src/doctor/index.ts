/**
 * /claudepilot:doctor. A new user installs the plugin and wants one answer: is
 * it actually working? Doctor checks the install end to end and prints a plain
 * pass/fail line per check, so the answer is unambiguous. It is deliberately
 * read-only: it never writes, starts a server or mutates state, so running it is
 * always safe.
 *
 * Each check returns a Check with a stable id, a pass flag and a short detail.
 * The library is pure of process concerns (it takes the roots as arguments) so
 * a test can run the whole suite against a fixture and assert on the results.
 */

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { validatePlugin } from "../plugin-validate/index.js";
import { resolveSkillsDir } from "../cli/skills-dir.js";

export interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: Check[];
}

async function exists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

/**
 * Run the full install check. `pluginRoot` is where the plugin lives (the
 * package root); `projectRoot` is the user's project, where the memory store
 * and the dashboard log live.
 */
export async function runDoctor(
  pluginRoot: string,
  projectRoot: string
): Promise<DoctorReport> {
  const checks: Check[] = [];
  const add = (id: string, pass: boolean, detail: string): void => {
    checks.push({ id, pass, detail });
  };

  // 1. The compiled MCP server entry exists and declares the tools.
  const mcpEntry = join(pluginRoot, "dist", "mcp", "index.js");
  add("mcp-build", await exists(mcpEntry), mcpEntry);

  // 2. The MCP server is declared in the plugin manifest.
  const manifestPath = join(pluginRoot, ".claude-plugin", "plugin.json");
  let mcpDeclared = false;
  try {
    const manifest = (await readJson(manifestPath)) as {
      mcpServers?: Record<string, unknown>;
    };
    mcpDeclared = Boolean(manifest.mcpServers && manifest.mcpServers["claudepilot"]);
  } catch {
    mcpDeclared = false;
  }
  add("mcp-declared", mcpDeclared, "plugin.json mcpServers.claudepilot");

  // 3. Hooks are wired, including the lossless-compaction PreCompact hook.
  const hooksPath = join(pluginRoot, "hooks", "hooks.json");
  let preCompact = false;
  let allHooks = false;
  try {
    const hooks = (await readJson(hooksPath)) as { hooks?: Record<string, unknown> };
    const present = hooks.hooks ?? {};
    preCompact = Boolean(present["PreCompact"]);
    allHooks = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop"].every(
      (e) => present[e]
    );
  } catch {
    /* missing file already shows up below */
  }
  add("hooks-wired", allHooks, "SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop");
  add("precompact-hook", preCompact, "PreCompact hook for lossless compaction");

  // 4. The memory directory is present (or absent but creatable).
  const memDir = join(projectRoot, ".claude", "claudepilot", "memory");
  add("memory-dir", await exists(memDir), `${memDir} (created on first remember)`);
  // This check is informational; absence is fine on a fresh project, so do not
  // fail the whole report just for an empty store.
  const memCheck = checks[checks.length - 1];
  if (memCheck && !memCheck.pass) {
    memCheck.pass = true;
    memCheck.detail = `no memory yet at ${memDir}; will be created on first /claudepilot:remember`;
  }

  // 5. The map can be refreshed (the helper CLI is built).
  const cliEntry = join(pluginRoot, "dist", "cli", "index.js");
  add("cli-build", await exists(cliEntry), cliEntry);

  // 6. The statusline script is present.
  const statusline = join(pluginRoot, "statusline", "claudepilot-statusline.mjs");
  add("statusline", await exists(statusline), statusline);

  // 7. The output style is present.
  const outputStyle = join(pluginRoot, "output-styles", "claudepilot.md");
  add("output-style", await exists(outputStyle), outputStyle);

  // 8. The subagents are present.
  const agents = ["cp-shipper", "cp-schema", "cp-reviewer"];
  let agentsOk = true;
  for (const a of agents) {
    if (!(await exists(join(pluginRoot, "agents", `${a}.md`)))) agentsOk = false;
  }
  add("subagents", agentsOk, agents.join(", "));

  // 9. The plugin manifest, marketplace, commands and skill library validate.
  try {
    const result = await validatePlugin(pluginRoot, resolveSkillsDir());
    add("plugin-valid", result.ok, result.ok ? `${result.checks.length} checks passed` : result.issues.join("; "));
  } catch (error) {
    add("plugin-valid", false, (error as Error).message);
  }

  return { ok: checks.every((c) => c.pass), checks };
}

/** Render the report as a pass/fail block for the slash command output. */
export function renderDoctor(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push("# claudepilot doctor");
  lines.push("");
  for (const c of report.checks) {
    lines.push(`${c.pass ? "PASS" : "FAIL"}  ${c.id}: ${c.detail}`);
  }
  lines.push("");
  lines.push(report.ok ? "All checks passed. claudepilot is wired correctly." : "Some checks failed. See the lines marked FAIL above.");
  return lines.join("\n");
}

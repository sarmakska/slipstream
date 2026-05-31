import { readFile, stat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadSkills, SkillValidationError } from "../engine/index.js";

/**
 * The plugin validator. It proves the published slipstream plugin is a valid
 * Claude Code plugin: a well formed plugin.json manifest, a marketplace.json
 * that points at it, valid hooks wiring, slash command files with frontmatter,
 * and a skill library that loads cleanly. It is run from tests and from the
 * `plugin-validate` CLI command, and it fails loudly on anything malformed.
 */

export interface PluginValidateResult {
  ok: boolean;
  checks: string[];
  issues: string[];
}

async function readJson(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

async function exists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

export async function validatePlugin(
  pluginRoot: string,
  skillsDir: string
): Promise<PluginValidateResult> {
  const checks: string[] = [];
  const issues: string[] = [];

  // 1. plugin.json manifest.
  const manifestPath = join(pluginRoot, ".claude-plugin", "plugin.json");
  if (!(await exists(manifestPath))) {
    issues.push(`missing manifest at ${manifestPath}`);
  } else {
    try {
      const manifest = (await readJson(manifestPath)) as Record<string, unknown>;
      if (manifest.name !== "slipstream") {
        issues.push(`plugin.json name must be "slipstream", got ${String(manifest.name)}`);
      }
      for (const field of ["version", "description", "author"]) {
        if (!manifest[field]) issues.push(`plugin.json is missing "${field}"`);
      }
      if (typeof manifest.version === "string" && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
        issues.push(`plugin.json version "${manifest.version}" is not semver`);
      }
      checks.push("plugin.json manifest is well formed");

      // The bundled MCP server must be declared so Claude Code loads it.
      const mcp = manifest.mcpServers as Record<string, unknown> | undefined;
      if (!mcp || !mcp["slipstream"]) {
        issues.push("plugin.json does not declare the slipstream MCP server under mcpServers");
      } else {
        checks.push("plugin.json declares the slipstream MCP server");
      }
      // The statusline command must be declared.
      if (!manifest.statusLine) {
        issues.push("plugin.json does not declare a statusLine command");
      } else {
        checks.push("plugin.json declares a statusLine command");
      }
    } catch (error) {
      issues.push(`plugin.json is not valid JSON: ${(error as Error).message}`);
    }
  }

  // 2. marketplace.json.
  const marketplacePath = join(pluginRoot, ".claude-plugin", "marketplace.json");
  if (!(await exists(marketplacePath))) {
    issues.push(`missing marketplace at ${marketplacePath}`);
  } else {
    try {
      const market = (await readJson(marketplacePath)) as Record<string, unknown>;
      if (!market.name) issues.push("marketplace.json is missing a name");
      const plugins = market.plugins as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(plugins) || plugins.length === 0) {
        issues.push("marketplace.json must list at least one plugin");
      } else if (!plugins.some((p) => p.name === "slipstream")) {
        issues.push("marketplace.json does not list a plugin named slipstream");
      } else {
        checks.push("marketplace.json lists the slipstream plugin");
      }
    } catch (error) {
      issues.push(`marketplace.json is not valid JSON: ${(error as Error).message}`);
    }
  }

  // 3. hooks wiring.
  const hooksPath = join(pluginRoot, "hooks", "hooks.json");
  if (!(await exists(hooksPath))) {
    issues.push(`missing hooks file at ${hooksPath}`);
  } else {
    try {
      const hooks = (await readJson(hooksPath)) as { hooks?: Record<string, unknown> };
      const wanted = [
        "SessionStart",
        "UserPromptSubmit",
        "PreToolUse",
        "PostToolUse",
        "SubagentStop",
        "Stop",
        "PreCompact"
      ];
      const present = hooks.hooks ?? {};
      for (const event of wanted) {
        if (!present[event]) issues.push(`hooks.json does not wire the ${event} hook`);
      }
      if (wanted.every((e) => present[e])) {
        checks.push(
          "hooks.json wires SessionStart, UserPromptSubmit, PreToolUse, " +
            "PostToolUse, SubagentStop, Stop and PreCompact"
        );
      }
    } catch (error) {
      issues.push(`hooks.json is not valid JSON: ${(error as Error).message}`);
    }
  }

  // 4. commands have frontmatter with a description.
  const commandsDir = join(pluginRoot, "commands");
  if (!(await exists(commandsDir))) {
    issues.push(`missing commands directory at ${commandsDir}`);
  } else {
    const files = (await readdir(commandsDir)).filter((f) => f.endsWith(".md"));
    if (files.length === 0) issues.push("commands directory has no slash commands");
    for (const file of files) {
      const raw = await readFile(join(commandsDir, file), "utf8");
      if (!raw.startsWith("---") || !/\bdescription:/.test(raw.split("---")[1] ?? "")) {
        issues.push(`command ${file} is missing frontmatter with a description`);
      }
    }
    if (files.length > 0) checks.push(`${files.length} slash commands have valid frontmatter`);
  }

  // 4b. subagents have frontmatter with name and description.
  const agentsDir = join(pluginRoot, "agents");
  if (!(await exists(agentsDir))) {
    issues.push(`missing agents directory at ${agentsDir}`);
  } else {
    const wantedAgents = ["sp-shipper", "sp-schema", "sp-reviewer"];
    const agentFiles = (await readdir(agentsDir)).filter((f) => f.endsWith(".md"));
    for (const a of wantedAgents) {
      if (!agentFiles.includes(`${a}.md`)) {
        issues.push(`agents directory is missing ${a}.md`);
        continue;
      }
      const raw = await readFile(join(agentsDir, `${a}.md`), "utf8");
      const front = raw.startsWith("---") ? raw.split("---")[1] ?? "" : "";
      if (!/\bname:/.test(front) || !/\bdescription:/.test(front)) {
        issues.push(`agent ${a}.md is missing name or description frontmatter`);
      }
    }
    if (wantedAgents.every((a) => agentFiles.includes(`${a}.md`))) {
      checks.push("agents sp-shipper, sp-schema and sp-reviewer have valid frontmatter");
    }
  }

  // 4c. the output style is present with frontmatter.
  const stylePath = join(pluginRoot, "output-styles", "slipstream.md");
  if (!(await exists(stylePath))) {
    issues.push(`missing output style at ${stylePath}`);
  } else {
    const raw = await readFile(stylePath, "utf8");
    if (!raw.startsWith("---") || !/\bdescription:/.test(raw.split("---")[1] ?? "")) {
      issues.push("output-styles/slipstream.md is missing frontmatter with a description");
    } else {
      checks.push("output-styles/slipstream.md is present with frontmatter");
    }
  }

  // 4d. the statusline script is present.
  if (!(await exists(join(pluginRoot, "statusline", "slipstream-statusline.mjs")))) {
    issues.push("missing statusline script at statusline/slipstream-statusline.mjs");
  } else {
    checks.push("statusline script is present");
  }

  // 5. the skill library loads cleanly.
  try {
    const skills = await loadSkills(skillsDir);
    checks.push(`${skills.length} skills load cleanly with valid SKILL.md frontmatter`);
  } catch (error) {
    if (error instanceof SkillValidationError) {
      for (const issue of error.issues) {
        issues.push(`skill ${issue.sourcePath}: ${issue.message}`);
      }
    } else {
      issues.push(`skill library failed to load: ${(error as Error).message}`);
    }
  }

  return { ok: issues.length === 0, checks, issues };
}

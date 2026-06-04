/**
 * Runtime detection of whether slipstream is running as a Claude Code plugin
 * (passive: hooks emit, hooks start the dashboard) or as a standalone MCP server
 * for another editor (active: the server emits events itself and auto-starts
 * the dashboard).
 *
 * Today users have to hand-set SLIPSTREAM_MCP_EMIT and SLIPSTREAM_DASHBOARD on
 * every editor. This module replaces that with a small, pure function so the
 * MCP entrypoint can pick the right behaviour on its own. The explicit env
 * vars still win, so a power user can override either way.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

export type Mode = "plugin" | "mcp-only";

export interface DetectInputs {
  env: NodeJS.ProcessEnv;
  cwd: string;
}

export interface DetectResult {
  mode: Mode;
  /** A short string that names the rule which decided the mode. */
  reason: string;
  /** True when the decision came from an explicit env var override. */
  explicit: boolean;
}

/**
 * Decide the runtime mode. Plugin mode wins on any of:
 *   - CLAUDE_PLUGIN_ROOT is set, OR
 *   - CLAUDE_CODE_SESSION is set, OR
 *   - the project root contains a .claude/hooks marker directory.
 * Otherwise the server is running standalone in another editor and we pick
 * mcp-only so it self-emits and auto-starts the dashboard.
 *
 * SLIPSTREAM_MODE=plugin or =mcp-only is the top-level escape hatch. The
 * legacy SLIPSTREAM_MCP_EMIT and SLIPSTREAM_DASHBOARD vars stay supported
 * elsewhere; this function reports a coherent overall mode.
 */
export function detectMode(input: DetectInputs): DetectResult {
  const { env, cwd } = input;

  const explicit = env["SLIPSTREAM_MODE"];
  if (explicit === "plugin" || explicit === "mcp-only") {
    return { mode: explicit, reason: "SLIPSTREAM_MODE", explicit: true };
  }

  if (env["CLAUDE_PLUGIN_ROOT"]) {
    return { mode: "plugin", reason: "CLAUDE_PLUGIN_ROOT", explicit: false };
  }
  if (env["CLAUDE_CODE_SESSION"]) {
    return { mode: "plugin", reason: "CLAUDE_CODE_SESSION", explicit: false };
  }
  if (existsSync(join(cwd, ".claude", "hooks"))) {
    return { mode: "plugin", reason: ".claude/hooks marker", explicit: false };
  }

  return { mode: "mcp-only", reason: "no Claude Code signals", explicit: false };
}

/**
 * Resolve the effective value of SLIPSTREAM_MCP_EMIT given the detected mode
 * and the user's explicit override (if any). The server emits when the result
 * is true; legacy explicit "0"/"1" still wins.
 */
export function shouldEmit(env: NodeJS.ProcessEnv, mode: Mode): boolean {
  const override = env["SLIPSTREAM_MCP_EMIT"];
  if (override === "0") return false;
  if (override === "1") return true;
  return mode === "mcp-only";
}

/**
 * Same idea for the auto-start dashboard. Plugin mode lets the SessionStart
 * hook do it; MCP-only mode does it from the server. SLIPSTREAM_DASHBOARD
 * still overrides.
 */
export function shouldStartDashboard(env: NodeJS.ProcessEnv, mode: Mode): boolean {
  const override = env["SLIPSTREAM_DASHBOARD"];
  if (override === "0") return false;
  if (override === "1") return true;
  return mode === "mcp-only";
}

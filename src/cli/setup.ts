/**
 * `slipstream setup` wires slipstream into whichever editor the user is on,
 * idempotently. Today users have to find the right config file per editor,
 * paste in the MCP server entry and (for Claude Code) edit hooks and skills
 * by hand. This command does it for them in one place, with a --dry-run mode
 * so the change is visible before it lands, and a refusal to double-wire
 * when both plugin-mode and standalone-mode configs exist.
 *
 * The whole module is pure on inputs (cwd, env) and writes to disk only at
 * the end, which makes it cheap to test against a tmp-dir fixture per editor.
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type Editor =
  | "claude-code"
  | "cursor"
  | "windsurf"
  | "antigravity"
  | "vscode";

export type EditorOrAuto = Editor | "auto";

export interface SetupOptions {
  cwd: string;
  editor: EditorOrAuto;
  dryRun: boolean;
}

export interface SetupResult {
  editor: Editor;
  /** Files written or that would have been written in dry-run mode. */
  changes: Array<{ path: string; before: string | null; after: string }>;
  exitCode: 0 | 2;
  /** Human-readable lines for the CLI to print. */
  notes: string[];
}

const SLIPSTREAM_MCP_ENTRY = {
  command: "node",
  args: ["${SLIPSTREAM_DIST}/mcp/index.js"]
} as const;

const SLIPSTREAM_STATUSLINE = {
  type: "command",
  command: "node \"${SLIPSTREAM_DIST}/cli/index.js\" statusline"
} as const;

const EDITOR_MCP_PATHS: Record<Exclude<Editor, "claude-code">, string> = {
  cursor: ".cursor/mcp.json",
  windsurf: ".windsurf/mcp.json",
  antigravity: ".antigravity/mcp.json",
  vscode: ".vscode/mcp.json"
};

/**
 * Detect which editor is in use from project-root markers. Claude Code wins
 * because it is the richest integration; the rest are checked in priority
 * order of how likely the user is to actually be in them.
 */
export function detectEditor(cwd: string): Editor | null {
  if (existsSync(join(cwd, ".claude"))) return "claude-code";
  if (existsSync(join(cwd, ".cursor"))) return "cursor";
  if (existsSync(join(cwd, ".windsurf"))) return "windsurf";
  if (existsSync(join(cwd, ".antigravity"))) return "antigravity";
  if (existsSync(join(cwd, ".vscode"))) return "vscode";
  return null;
}

/** Read a JSON file if it exists, return null otherwise. */
async function readJsonIfExists(path: string): Promise<unknown | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Refuse to double-wire: if a project already has the plugin (.claude with
 * hooks pointing at slipstream) AND a standalone .mcp.json with a slipstream
 * entry, the result is duplicate event emission. This guard reports it.
 */
export function detectDoubleWire(cwd: string): boolean {
  const pluginMode = existsSync(join(cwd, ".claude", "hooks"));
  if (!pluginMode) return false;
  const mcpJson = join(cwd, ".mcp.json");
  if (!existsSync(mcpJson)) return false;
  try {
    // Synchronous read intentional: this is a guard, not a hot path.
    const raw = readFileSync(mcpJson, "utf8");
    const parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
    return Boolean(parsed?.mcpServers?.["slipstream"]);
  } catch {
    return false;
  }
}

/**
 * Build the desired `.claude/settings.local.json` shape: statusline, skills
 * pointer, hooks pointer, and the MCP server entry. Idempotent: existing keys
 * are preserved, only the slipstream-owned blocks are overwritten.
 */
export function buildClaudeSettings(prev: Record<string, unknown> | null): Record<string, unknown> {
  const base: Record<string, unknown> = prev ? { ...prev } : {};
  base["statusLine"] = SLIPSTREAM_STATUSLINE;
  base["skills"] = "${SLIPSTREAM_DIST}/../skills";
  base["hooks"] = "${SLIPSTREAM_DIST}/../hooks/hooks.json";
  const servers = (base["mcpServers"] as Record<string, unknown> | undefined) ?? {};
  servers["slipstream"] = {
    command: SLIPSTREAM_MCP_ENTRY.command,
    args: [...SLIPSTREAM_MCP_ENTRY.args]
  };
  base["mcpServers"] = servers;
  return base;
}

/**
 * Build the desired editor mcp.json shape (Cursor, Windsurf, Antigravity,
 * VS Code). All four use the same `mcpServers` key by convention.
 */
export function buildEditorMcpConfig(prev: Record<string, unknown> | null): Record<string, unknown> {
  const base: Record<string, unknown> = prev ? { ...prev } : {};
  const servers = (base["mcpServers"] as Record<string, unknown> | undefined) ?? {};
  servers["slipstream"] = {
    command: SLIPSTREAM_MCP_ENTRY.command,
    args: [...SLIPSTREAM_MCP_ENTRY.args]
  };
  base["mcpServers"] = servers;
  return base;
}

/** Pretty-print JSON the way every editor's config file expects it. */
function fmt(obj: unknown): string {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

/**
 * Plan and (unless dry-run) apply the setup for the chosen editor. Returns
 * the diff in a structured form so the CLI can print it and tests can
 * assert on it without parsing console output.
 */
export async function runSetup(opts: SetupOptions): Promise<SetupResult> {
  const cwd = resolve(opts.cwd);
  const notes: string[] = [];

  if (detectDoubleWire(cwd)) {
    return {
      editor: "claude-code",
      changes: [],
      exitCode: 2,
      notes: [
        "double-wire detected: .claude/hooks (plugin mode) AND .mcp.json with a slipstream entry are both present.",
        "this would emit dashboard events twice. remove the slipstream entry from .mcp.json or disable the plugin, then re-run."
      ]
    };
  }

  let editor: Editor;
  if (opts.editor === "auto") {
    const detected = detectEditor(cwd);
    if (!detected) {
      return {
        editor: "claude-code",
        changes: [],
        exitCode: 2,
        notes: [
          "no editor detected. pass --editor=claude-code|cursor|windsurf|antigravity|vscode."
        ]
      };
    }
    editor = detected;
    notes.push(`detected editor: ${editor}`);
  } else {
    editor = opts.editor;
  }

  const changes: SetupResult["changes"] = [];

  if (editor === "claude-code") {
    const path = join(cwd, ".claude", "settings.local.json");
    const prev = (await readJsonIfExists(path)) as Record<string, unknown> | null;
    const next = buildClaudeSettings(prev);
    const before = prev ? fmt(prev) : null;
    const after = fmt(next);
    changes.push({ path, before, after });
  } else {
    const rel = EDITOR_MCP_PATHS[editor];
    const path = join(cwd, rel);
    const prev = (await readJsonIfExists(path)) as Record<string, unknown> | null;
    const next = buildEditorMcpConfig(prev);
    const before = prev ? fmt(prev) : null;
    const after = fmt(next);
    changes.push({ path, before, after });
  }

  if (opts.dryRun) {
    notes.push("dry-run: no files written. proposed changes follow.");
    for (const c of changes) {
      notes.push(`--- ${c.path}`);
      notes.push(c.before === null ? "(new file)" : c.before);
      notes.push("+++ would write:");
      notes.push(c.after);
    }
    return { editor, changes, exitCode: 0, notes };
  }

  for (const c of changes) {
    await mkdir(dirname(c.path), { recursive: true });
    await writeFile(c.path, c.after, "utf8");
    notes.push(c.before === null ? `wrote ${c.path}` : `updated ${c.path}`);
  }
  return { editor, changes, exitCode: 0, notes };
}

/** Parse argv-style flags into SetupOptions. Defensive: unknown flags ignored. */
export function parseSetupArgs(args: string[], cwd: string): SetupOptions {
  let editor: EditorOrAuto = "auto";
  let dryRun = false;
  for (const arg of args) {
    if (arg.startsWith("--editor=")) {
      const v = arg.slice("--editor=".length);
      if (
        v === "auto" ||
        v === "claude-code" ||
        v === "cursor" ||
        v === "windsurf" ||
        v === "antigravity" ||
        v === "vscode"
      ) {
        editor = v;
      }
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }
  return { cwd, editor, dryRun };
}

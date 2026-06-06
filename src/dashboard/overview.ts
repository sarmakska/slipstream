/**
 * Overview: turn the structural project map into a human-readable picture of
 * what the project is and how it is organised. The dashboard opens on this, so
 * a person who has never seen the codebase can read, in plain English, what the
 * thing is, which areas it is built from and what each area does.
 *
 * Pure over the ProjectMap. No network, no LLM. The role labels are a small
 * deterministic lookup with a heuristic fallback, so the same map always
 * produces the same overview and the tests can pin it.
 */

import type { ProjectMap } from "../map/types.js";

/** One architectural area: a top-level part of the codebase and its role. */
export interface AreaSummary {
  area: string;
  files: number;
  symbols: number;
  lines: number;
  /** A plain-English sentence for what this area is for. */
  role: string;
}

export interface OverviewMap {
  fileCount: number;
  symbolCount: number;
  kib: number;
  entryPoints: string[];
  /** The areas, largest first by symbol count. */
  areas: AreaSummary[];
}

/**
 * Known areas get a hand-written role so the overview reads well. The key is the
 * grouped area path. Anything not listed falls back to a heuristic from the
 * files' own inferred purposes.
 */
const ROLES: Record<string, string> = {
  "src/dashboard": "The local dashboard server, its JSON API and the rendered UI.",
  "src/memory": "The self-building observation memory, durable facts and three-layer search.",
  "src/mcp": "The bundled MCP server and the scoped-retrieval tools editors call.",
  "src/cli": "The command line: setup, dashboard, memory and map subcommands.",
  "src/context": "Token budgeting and the savings tally for scoped versus whole-file reads.",
  "src/map": "The scoped code map: scan the tree, infer purpose, retrieve single symbols.",
  "src/budget": "Compaction forecasting: how many steps remain before a digest is due.",
  "src/engine": "The shared engine that ties the pieces together behind the CLI and MCP.",
  "src/doctor": "Diagnostics that catch common cross-editor setup problems.",
  "src/statusline": "The context-budget statusline rendered in the editor.",
  "src/plugin-validate": "Validation for the plugin manifest and shipped assets.",
  "src/util": "Shared low-level helpers used across the codebase.",
  tests: "The test suite that pins behaviour across the whole project.",
  hooks: "The Claude Code lifecycle hooks that feed the dashboard and memory.",
  skills: "The shipped skills that guide work in specific domains.",
  agents: "The shipped subagents for delegated tasks.",
  commands: "The slash commands the plugin registers."
};

/** Group a file path into its architectural area. */
function areaOf(path: string): string {
  const parts = path.replace(/^\/+/, "").split("/");
  if (parts[0] === "src" && parts.length > 2) return `src/${parts[1]}`;
  return parts[0] ?? path;
}

/** Fallback role from the most common inferred purpose in the area. */
function heuristicRole(purposes: string[]): string {
  const counts = new Map<string, number>();
  for (const p of purposes) {
    if (!p) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? `${top}.` : "Source files in this area.";
}

export function summariseMap(map: ProjectMap): OverviewMap {
  const grouped = new Map<string, { files: number; symbols: number; lines: number; purposes: string[] }>();
  for (const f of map.files) {
    const area = areaOf(f.path);
    const cur = grouped.get(area) ?? { files: 0, symbols: 0, lines: 0, purposes: [] };
    cur.files += 1;
    cur.symbols += f.symbols.length;
    cur.lines += f.lines;
    cur.purposes.push(f.purpose);
    grouped.set(area, cur);
  }

  const areas: AreaSummary[] = [...grouped.entries()]
    .map(([area, v]) => ({
      area,
      files: v.files,
      symbols: v.symbols,
      lines: v.lines,
      role: ROLES[area] ?? heuristicRole(v.purposes)
    }))
    .sort((a, b) => b.symbols - a.symbols || b.files - a.files);

  return {
    fileCount: map.stats.fileCount,
    symbolCount: map.stats.symbolCount,
    kib: Math.round((map.stats.totalBytes / 1024) * 10) / 10,
    entryPoints: map.entryPoints,
    areas
  };
}

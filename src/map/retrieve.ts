import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectMap, SymbolSlice } from "./types.js";

/**
 * Retrieve a bounded line range from a file. This is the second scoped read
 * helper: when an agent knows the lines it wants (from the map or a previous
 * slice) it pulls exactly that window rather than the whole file.
 */
export async function retrieveLines(
  root: string,
  filePath: string,
  start: number,
  end: number
): Promise<SymbolSlice | null> {
  const absPath = join(root, filePath);
  const source = await readFile(absPath, "utf8").catch(() => null);
  if (source === null) return null;
  const lines = source.split("\n");
  const from = Math.max(1, Math.min(start, lines.length));
  const to = Math.max(from, Math.min(end, lines.length));
  return {
    path: filePath,
    symbol: `lines ${from}-${to}`,
    kind: "default",
    startLine: from,
    endLine: to,
    code: lines.slice(from - 1, to).join("\n")
  };
}

/**
 * Find the line span of a symbol by walking braces from its declaration line.
 * This is the heart of scoped retrieval: instead of returning a whole file we
 * return just the declaration the agent asked about.
 */
function spanFromLine(lines: string[], startIndex: number): number {
  // Type aliases and single line consts often end at the first semicolon
  // before any brace opens.
  let depth = 0;
  let opened = false;
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    for (const char of line) {
      if (char === "{" || char === "(" || char === "[") {
        depth += 1;
        opened = true;
      } else if (char === "}" || char === ")" || char === "]") {
        depth -= 1;
      }
    }
    if (opened && depth <= 0) {
      return i;
    }
    if (!opened && line.trimEnd().endsWith(";")) {
      return i;
    }
    if (!opened && i > startIndex && lines[i + 1] !== undefined) {
      // A declaration with no braces and no semicolon that runs onto a blank
      // line is treated as a single logical line.
      const next = (lines[i + 1] ?? "").trim();
      if (next === "" || next.startsWith("export")) {
        return i;
      }
    }
  }
  return lines.length - 1;
}

/**
 * Retrieve a single symbol's source as a scoped slice. Returns null when the
 * map has no such symbol, so the agent can fall back to a wider read only when
 * it genuinely must.
 */
export async function retrieveSymbol(
  map: ProjectMap,
  filePath: string,
  symbolName: string
): Promise<SymbolSlice | null> {
  const file = map.files.find((f) => f.path === filePath);
  if (!file) return null;
  const symbol = file.symbols.find((s) => s.name === symbolName);
  if (!symbol) return null;

  const absPath = join(map.root, filePath);
  const source = await readFile(absPath, "utf8");
  const lines = source.split("\n");
  const startIndex = symbol.line - 1;
  if (startIndex < 0 || startIndex >= lines.length) return null;

  // Capture a leading doc comment if one sits directly above the symbol.
  let docStart = startIndex;
  for (let i = startIndex - 1; i >= 0; i -= 1) {
    const t = (lines[i] ?? "").trim();
    if (t.endsWith("*/") || t.startsWith("*") || t.startsWith("/**") || t.startsWith("//")) {
      docStart = i;
    } else {
      break;
    }
  }

  const endIndex = spanFromLine(lines, startIndex);
  const code = lines.slice(docStart, endIndex + 1).join("\n");

  return {
    path: filePath,
    symbol: symbolName,
    kind: symbol.kind,
    startLine: docStart + 1,
    endLine: endIndex + 1,
    code
  };
}

/**
 * Rank files by how well their purpose and symbols match a free text query.
 * The agent uses this to pick which one slice to pull, without reading any
 * file contents.
 */
export function searchMap(
  map: ProjectMap,
  query: string,
  limit = 8
): Array<{ path: string; purpose: string; score: number; symbols: string[] }> {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
  if (terms.length === 0) return [];

  const scored = map.files.map((file) => {
    const haystack = (
      file.path +
      " " +
      file.purpose +
      " " +
      file.symbols.map((s) => s.name).join(" ")
    ).toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (file.path.toLowerCase().includes(term)) score += 3;
      for (const symbol of file.symbols) {
        if (symbol.name.toLowerCase().includes(term)) score += 2;
      }
      if (file.purpose.toLowerCase().includes(term)) score += 1;
      else if (haystack.includes(term)) score += 0.5;
    }
    return {
      path: file.path,
      purpose: file.purpose,
      score,
      symbols: file.symbols.map((s) => s.name)
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

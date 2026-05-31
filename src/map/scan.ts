import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { ExportedSymbol, SymbolKind } from "./types.js";

/** Directories we never descend into when scanning a project. */
export const DEFAULT_IGNORES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".vercel",
  ".turbo",
  ".cache",
  "out"
]);

/** File extensions we know how to extract symbols from. */
const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs"
]);

export interface ScannedFile {
  absPath: string;
  relPath: string;
  bytes: number;
}

/** Walk a tree, skipping ignored directories, returning candidate files. */
export async function walk(
  root: string,
  ignores: Set<string> = DEFAULT_IGNORES
): Promise<ScannedFile[]> {
  const out: ScannedFile[] = [];

  async function recurse(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".github") {
        if (DEFAULT_IGNORES.has(entry.name)) continue;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignores.has(entry.name)) continue;
        await recurse(full);
      } else if (entry.isFile()) {
        const ext = entry.name.slice(entry.name.lastIndexOf("."));
        if (!CODE_EXTENSIONS.has(ext)) continue;
        const info = await stat(full);
        out.push({
          absPath: full,
          relPath: relative(root, full).split(sep).join("/"),
          bytes: info.size
        });
      }
    }
  }

  await recurse(root);
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

const EXPORT_PATTERNS: Array<{ re: RegExp; kind: SymbolKind }> = [
  { re: /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/, kind: "function" },
  { re: /^export\s+class\s+([A-Za-z_$][\w$]*)/, kind: "class" },
  { re: /^export\s+interface\s+([A-Za-z_$][\w$]*)/, kind: "interface" },
  { re: /^export\s+type\s+([A-Za-z_$][\w$]*)/, kind: "type" },
  { re: /^export\s+enum\s+([A-Za-z_$][\w$]*)/, kind: "enum" },
  {
    re: /^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/,
    kind: "const"
  }
];

const IMPORT_RE = /(?:^import\b[^'"]*from\s*|^import\s*|\brequire\s*\()\s*['"]([^'"]+)['"]/;

/**
 * Extract the exported surface of a source file with a fast, dependency free
 * line scan. This is intentionally heuristic: a project map favours being
 * cheap and good enough over a full parse, because the agent uses the map to
 * decide where to look, then reads the real slice.
 */
export function extractSymbols(source: string): {
  symbols: ExportedSymbol[];
  imports: string[];
  lines: number;
} {
  const lines = source.split("\n");
  const symbols: ExportedSymbol[] = [];
  const imports = new Set<string>();

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    const importMatch = IMPORT_RE.exec(trimmed);
    if (importMatch && importMatch[1]) {
      imports.add(importMatch[1]);
    }

    if (/^export\s+default\b/.test(trimmed)) {
      symbols.push({ name: "default", kind: "default", line: index + 1 });
      return;
    }

    for (const { re, kind } of EXPORT_PATTERNS) {
      const match = re.exec(trimmed);
      if (match && match[1]) {
        // A const assigned an arrow function that returns JSX is a component.
        const resolvedKind: SymbolKind =
          kind === "const" && /=>\s*(?:<|\()/.test(trimmed) && /^[A-Z]/.test(match[1])
            ? "component"
            : kind;
        symbols.push({ name: match[1], kind: resolvedKind, line: index + 1 });
        break;
      }
    }
  });

  return { symbols, imports: [...imports], lines: lines.length };
}

/** First leading line comment, used as the purpose when present. */
export function inferPurpose(source: string, relPath: string): string {
  const lines = source.split("\n");
  for (const line of lines.slice(0, 12)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) {
      return trimmed.replace(/^\/\/+\s*/, "").slice(0, 160);
    }
    const block = /^\/\*\*?\s*(.+?)\s*(?:\*\/)?$/.exec(trimmed);
    if (block && block[1] && block[1] !== "*") {
      return block[1].replace(/^\*\s*/, "").slice(0, 160);
    }
    if (trimmed.length > 0 && !trimmed.startsWith("/*") && trimmed !== "*") {
      break;
    }
  }
  // Heuristic fallback from the path.
  const base = relPath.split("/").pop() ?? relPath;
  if (base.includes(".test.")) return "test suite";
  if (base.includes(".config.")) return "configuration";
  if (relPath.includes("/cli/")) return "command line entry";
  return `source module ${base}`;
}

export async function readSource(absPath: string): Promise<string> {
  return readFile(absPath, "utf8");
}

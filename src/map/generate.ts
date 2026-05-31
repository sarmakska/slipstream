import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  extractSymbols,
  inferPurpose,
  readSource,
  walk,
  DEFAULT_IGNORES
} from "./scan.js";
import type { FileEntry, ProjectMap } from "./types.js";

export interface GenerateOptions {
  ignores?: Set<string>;
}

async function detectEntryPoints(root: string): Promise<string[]> {
  const entries = new Set<string>();
  try {
    const pkgRaw = await readFile(join(root, "package.json"), "utf8");
    const pkg = JSON.parse(pkgRaw) as {
      main?: string;
      module?: string;
      bin?: string | Record<string, string>;
    };
    if (pkg.main) entries.add(pkg.main.replace(/^\.\//, ""));
    if (pkg.module) entries.add(pkg.module.replace(/^\.\//, ""));
    if (typeof pkg.bin === "string") entries.add(pkg.bin.replace(/^\.\//, ""));
    else if (pkg.bin) {
      for (const value of Object.values(pkg.bin)) {
        entries.add(value.replace(/^\.\//, ""));
      }
    }
  } catch {
    // No package.json, that is fine.
  }
  return [...entries].sort();
}

/**
 * Generate a compact project map. This reads each candidate file once,
 * extracts only its public surface, and never stores file contents, so the
 * resulting JSON stays small even for large trees.
 */
export async function generateMap(
  rootInput: string,
  options: GenerateOptions = {}
): Promise<ProjectMap> {
  const root = resolve(rootInput);
  const ignores = options.ignores ?? DEFAULT_IGNORES;
  const scanned = await walk(root, ignores);

  const files: FileEntry[] = [];
  let symbolCount = 0;
  let totalBytes = 0;

  for (const file of scanned) {
    const source = await readSource(file.absPath);
    const { symbols, imports, lines } = extractSymbols(source);
    const purpose = inferPurpose(source, file.relPath);
    symbolCount += symbols.length;
    totalBytes += file.bytes;
    files.push({
      path: file.relPath,
      purpose,
      symbols,
      imports,
      bytes: file.bytes,
      lines
    });
  }

  return {
    version: 1,
    root,
    generatedAt: new Date().toISOString(),
    entryPoints: await detectEntryPoints(root),
    files,
    stats: {
      fileCount: files.length,
      symbolCount,
      totalBytes
    }
  };
}

/** Render the map as compact, deterministic JSON. */
export function mapToJson(map: ProjectMap): string {
  return JSON.stringify(map, null, 2);
}

/** Render the map as a scannable Markdown index grouped by directory. */
export function mapToMarkdown(map: ProjectMap): string {
  const lines: string[] = [];
  lines.push("# Project map");
  lines.push("");
  lines.push(
    `Generated ${map.generatedAt} over ${map.stats.fileCount} files, ` +
      `${map.stats.symbolCount} exported symbols, ` +
      `${(map.stats.totalBytes / 1024).toFixed(1)} KiB of source.`
  );
  lines.push("");
  if (map.entryPoints.length > 0) {
    lines.push("## Entry points");
    lines.push("");
    for (const entry of map.entryPoints) {
      lines.push(`- \`${entry}\``);
    }
    lines.push("");
  }

  const byDir = new Map<string, FileEntry[]>();
  for (const file of map.files) {
    const slash = file.path.lastIndexOf("/");
    const dir = slash === -1 ? "." : file.path.slice(0, slash);
    const bucket = byDir.get(dir) ?? [];
    bucket.push(file);
    byDir.set(dir, bucket);
  }

  lines.push("## Files");
  lines.push("");
  for (const dir of [...byDir.keys()].sort()) {
    lines.push(`### ${dir}`);
    lines.push("");
    for (const file of byDir.get(dir) ?? []) {
      const name = file.path.split("/").pop();
      lines.push(`- \`${name}\` (${file.lines} lines) - ${file.purpose}`);
      if (file.symbols.length > 0) {
        const surface = file.symbols
          .map((s) => `${s.name} (${s.kind})`)
          .join(", ");
        lines.push(`  - exports: ${surface}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

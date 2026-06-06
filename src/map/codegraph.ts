/**
 * Code graph: a dependency graph of the project, files as nodes and imports as
 * edges, built from the scoped map. This is the graphify-style view: see how the
 * codebase actually wires together, find the god nodes everything flows through,
 * and click into any file. Pure over the ProjectMap.
 */

import type { ProjectMap } from "./types.js";

export interface CodeNode {
  id: string;
  label: string;
  /** Top-level architectural area, for colouring and clustering. */
  area: string;
  symbols: number;
  lines: number;
  /** In plus out degree; the god nodes have the highest. */
  degree: number;
}

export interface CodeEdge {
  source: string;
  target: string;
}

export interface CodeGraph {
  nodes: CodeNode[];
  edges: CodeEdge[];
}

function areaOf(path: string): string {
  const parts = path.split("/");
  if (parts[0] === "src" && parts.length > 2) return `src/${parts[1]}`;
  return parts[0] ?? path;
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Resolve a relative import specifier from an importer to a repo file path. */
export function resolveImport(importer: string, spec: string, fileSet: Set<string>): string | null {
  if (!spec.startsWith(".")) return null; // external package or node builtin
  const parts = importer.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    else if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  const joined = parts.join("/");
  const candidates = [
    joined.replace(/\.js$/, ".ts"),
    joined.replace(/\.js$/, ".tsx"),
    joined.replace(/\.jsx$/, ".tsx"),
    joined.replace(/\.mjs$/, ".mjs"),
    joined,
    `${joined}/index.ts`,
    `${joined.replace(/\.js$/, "")}/index.ts`
  ];
  for (const c of candidates) if (fileSet.has(c)) return c;
  return null;
}

export function buildCodeGraph(map: ProjectMap): CodeGraph {
  const fileSet = new Set(map.files.map((f) => f.path));
  const degree = new Map<string, number>();
  const edges: CodeEdge[] = [];
  const seen = new Set<string>();

  for (const file of map.files) {
    for (const spec of file.imports || []) {
      const target = resolveImport(file.path, spec, fileSet);
      if (!target || target === file.path) continue;
      const key = `${file.path}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: file.path, target });
      degree.set(file.path, (degree.get(file.path) ?? 0) + 1);
      degree.set(target, (degree.get(target) ?? 0) + 1);
    }
  }

  const nodes: CodeNode[] = map.files.map((f) => ({
    id: f.path,
    label: baseName(f.path),
    area: areaOf(f.path),
    symbols: f.symbols.length,
    lines: f.lines,
    degree: degree.get(f.path) ?? 0
  }));

  return { nodes, edges };
}

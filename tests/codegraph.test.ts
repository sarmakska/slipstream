import { describe, expect, it } from "vitest";
import { buildCodeGraph, resolveImport } from "../src/map/codegraph.js";
import type { ProjectMap, FileEntry } from "../src/map/types.js";

function file(path: string, imports: string[]): FileEntry {
  return { path, purpose: "", symbols: [{ name: "x", kind: "function" }], imports, bytes: 100, lines: 30 };
}
function map(files: FileEntry[]): ProjectMap {
  return { version: 1, root: "/r", generatedAt: "t", entryPoints: [], files, stats: { fileCount: files.length, symbolCount: files.length, totalBytes: 0 } };
}

describe("resolveImport", () => {
  const set = new Set(["src/a/c.ts", "src/d/e.ts", "src/x/index.ts"]);
  it("resolves a sibling relative import, .js to .ts", () => {
    expect(resolveImport("src/a/b.ts", "./c.js", set)).toBe("src/a/c.ts");
  });
  it("resolves a parent relative import", () => {
    expect(resolveImport("src/a/b.ts", "../d/e.js", set)).toBe("src/d/e.ts");
  });
  it("resolves a directory import to index.ts", () => {
    expect(resolveImport("src/a/b.ts", "../x/index.js", set)).toBe("src/x/index.ts");
  });
  it("returns null for external packages and node builtins", () => {
    expect(resolveImport("src/a/b.ts", "node:http", set)).toBeNull();
    expect(resolveImport("src/a/b.ts", "zod", set)).toBeNull();
  });
});

describe("buildCodeGraph", () => {
  it("builds file nodes and import edges with degree", () => {
    const g = buildCodeGraph(map([
      file("src/dash/server.ts", ["./log.js", "node:http"]),
      file("src/dash/log.ts", [])
    ]));
    expect(g.nodes).toHaveLength(2);
    expect(g.edges).toEqual([{ source: "src/dash/server.ts", target: "src/dash/log.ts" }]);
    const server = g.nodes.find((n) => n.id === "src/dash/server.ts")!;
    const log = g.nodes.find((n) => n.id === "src/dash/log.ts")!;
    expect(server.degree).toBe(1);
    expect(log.degree).toBe(1);
    expect(server.area).toBe("src/dash");
    expect(server.label).toBe("server.ts");
  });

  it("dedupes repeated edges and ignores unresolved imports", () => {
    const g = buildCodeGraph(map([
      file("src/a.ts", ["./b.js", "./b.js", "./missing.js"]),
      file("src/b.ts", [])
    ]));
    expect(g.edges).toHaveLength(1);
  });
});

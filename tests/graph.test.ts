import { describe, expect, it } from "vitest";
import { buildGraph } from "../src/dashboard/graph.js";
import type { Observation } from "../src/memory/observe.js";

function obs(session: string, files: string[]): Observation {
  return { id: 1, session, ts: "2026-06-06T12:00:00Z", kind: "edit", summary: "x", detail: "", files, tags: [], vector: [] };
}

describe("buildGraph", () => {
  it("creates file and session nodes with an edge between them", () => {
    const g = buildGraph([obs("s1", ["src/a.ts"])]);
    expect(g.nodes.some((n) => n.kind === "file" && n.id === "file:src/a.ts")).toBe(true);
    expect(g.nodes.some((n) => n.kind === "session" && n.id === "session:s1")).toBe(true);
    expect(g.edges).toEqual([{ from: "session:s1", to: "file:src/a.ts", weight: 1 }]);
  });

  it("weights a file by how many observations touch it", () => {
    const g = buildGraph([obs("s1", ["src/a.ts"]), obs("s2", ["src/a.ts"])]);
    const file = g.nodes.find((n) => n.id === "file:src/a.ts");
    expect(file!.weight).toBe(2);
    expect(g.edges).toHaveLength(2);
  });

  it("shortens file labels to the last two segments", () => {
    const g = buildGraph([obs("s", ["a/b/c/deep.ts"])]);
    expect(g.nodes.find((n) => n.kind === "file")!.label).toBe("c/deep.ts");
  });

  it("keeps only the heaviest files when capped", () => {
    const observations = [
      obs("s", ["hot.ts"]), obs("s", ["hot.ts"]), obs("s", ["cold.ts"])
    ];
    const g = buildGraph(observations, 1);
    const fileNodes = g.nodes.filter((n) => n.kind === "file");
    expect(fileNodes).toHaveLength(1);
    expect(fileNodes[0]!.id).toBe("file:hot.ts");
  });

  it("returns an empty graph for no observations", () => {
    expect(buildGraph([])).toEqual({ nodes: [], edges: [] });
  });
});

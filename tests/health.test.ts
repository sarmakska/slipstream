import { describe, expect, it } from "vitest";
import { memoryHealth } from "../src/memory/health.js";
import type { Memory } from "../src/memory/types.js";

const NOW = new Date("2026-06-06T12:00:00Z").getTime();

function mem(partial: Partial<Memory>): Memory {
  return {
    name: "m", description: "a fact", type: "fact", tags: [],
    created: "2026-06-06T12:00:00Z", updated: "2026-06-06T12:00:00Z",
    body: "x", sourcePath: "/x.md", ...partial
  };
}

describe("memoryHealth", () => {
  it("reports a clean store when all are distinct and current", () => {
    const h = memoryHealth([mem({ name: "a", description: "first" }), mem({ name: "b", description: "second" })], NOW);
    expect(h.total).toBe(2);
    expect(h.duplicates).toBe(0);
    expect(h.stale).toBe(0);
    expect(h.note).toContain("current and distinct");
  });

  it("counts memories sharing a description as duplicates", () => {
    const h = memoryHealth([
      mem({ name: "a", description: "same fact" }),
      mem({ name: "b", description: "Same Fact" }),
      mem({ name: "c", description: "unique" })
    ], NOW);
    expect(h.duplicates).toBe(2);
    expect(h.note).toContain("duplicates");
  });

  it("counts entries past the stale window", () => {
    const h = memoryHealth([
      mem({ name: "old", description: "x", updated: "2026-01-01T00:00:00Z" }),
      mem({ name: "new", description: "y", updated: "2026-06-05T00:00:00Z" })
    ], NOW, 60);
    expect(h.stale).toBe(1);
    expect(h.note).toContain("stale");
  });

  it("tallies by type", () => {
    const h = memoryHealth([
      mem({ name: "a", description: "1", type: "decision" }),
      mem({ name: "b", description: "2", type: "decision" }),
      mem({ name: "c", description: "3", type: "gotcha" })
    ], NOW);
    expect(h.byType.decision).toBe(2);
    expect(h.byType.gotcha).toBe(1);
  });

  it("handles an empty store", () => {
    const h = memoryHealth([], NOW);
    expect(h.total).toBe(0);
    expect(h.note).toContain("0 memories");
  });
});

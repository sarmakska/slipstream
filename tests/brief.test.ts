import { describe, expect, it } from "vitest";
import { projectBrief, type BriefInput } from "../src/dashboard/brief.js";

function input(over: Partial<BriefInput> = {}): BriefInput {
  return {
    name: "slipstream",
    version: "0.24.0",
    narration: "This project is 120 files across 18 areas.",
    map: { fileCount: 120, symbolCount: 328, kib: 589, entryPoints: [], areas: [{ area: "src/dashboard", files: 17, symbols: 79, role: "The dashboard." }] },
    built: "Across 3 sessions and 4 observations, your focus has been src/dashboard.",
    memories: [{ name: "auth-decision", type: "decision", description: "JWT only" }],
    lessons: [{ title: "scoped reads", summary: "prefer the map", count: 5 }],
    instincts: [{ subject: "src/dashboard/ui.ts", note: "ui.ts is a hot spot", confidence: 0.6 }],
    recent: [{ ask: "add a graph", summary: "added the graph tab" }],
    savedTokens: 9000,
    savedUsd: 0.03,
    generatedAt: "2026-06-06T16:00:00Z",
    ...over
  };
}

describe("projectBrief", () => {
  it("includes every section a newcomer needs", () => {
    const md = projectBrief(input());
    expect(md).toContain("# slipstream v0.24.0");
    expect(md).toContain("## What this is");
    expect(md).toContain("This project is 120 files");
    expect(md).toContain("## How it is organised");
    expect(md).toContain("| src/dashboard | 17 | 79 | The dashboard. |");
    expect(md).toContain("## What has been built");
    expect(md).toContain("## Recent work");
    expect(md).toContain("added the graph tab");
    expect(md).toContain("## Durable memory");
    expect(md).toContain("**auth-decision** (decision): JWT only");
    expect(md).toContain("## Lessons learned");
    expect(md).toContain("## Instincts");
    expect(md).toContain("ui.ts is a hot spot (60% confidence)");
  });

  it("notes the token savings when present", () => {
    expect(projectBrief(input())).toContain("9,000 tokens");
  });

  it("degrades gracefully with no data", () => {
    const md = projectBrief(input({ map: null, memories: [], lessons: [], instincts: [], recent: [], built: "", savedTokens: 0 }));
    expect(md).toContain("(nothing observed yet)");
    expect(md).toContain("(no durable memories yet)");
    expect(md).toContain("(no recurring patterns yet)");
  });
});

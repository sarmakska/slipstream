import { describe, expect, it } from "vitest";
import { benchmarkRow, formatBenchmark } from "../src/map/benchmark.js";

describe("benchmarkRow", () => {
  it("estimates tokens at the byte rate and computes the reduction", () => {
    const r = benchmarkRow("a.ts", "foo", 3600, 360, 3.6);
    expect(r.wholeTokens).toBe(1000);
    expect(r.scopedTokens).toBe(100);
    expect(r.reductionPct).toBe(90);
  });

  it("reports zero reduction for an empty file", () => {
    expect(benchmarkRow("a.ts", "x", 0, 0).reductionPct).toBe(0);
  });
});

describe("formatBenchmark", () => {
  it("renders a Markdown table with a totals row", () => {
    const md = formatBenchmark([
      benchmarkRow("a.ts", "foo", 3600, 360, 3.6),
      benchmarkRow("b.ts", "bar", 7200, 720, 3.6)
    ], 3.6);
    expect(md).toContain("| File | Symbol | Whole tokens | Scoped tokens | Reduction |");
    expect(md).toContain("| a.ts | foo | 1000 | 100 | 90% |");
    expect(md).toContain("**Total**");
    expect(md).toContain("**3000**");
    expect(md).toContain("**90%**");
  });
});

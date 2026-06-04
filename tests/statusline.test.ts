import { describe, expect, it } from "vitest";
import { formatStatusline } from "../src/statusline/index.js";
import { DEFAULT_WINDOW_TOKENS, BYTES_PER_TOKEN } from "../src/context/budget.js";

describe("formatStatusline", () => {
  it("emits the full line with budget, memory, skill and model", () => {
    const line = formatStatusline({
      bytesRead: 50_000,
      memoryCount: 4,
      activeSkill: "scoped-read",
      model: "Opus 4.8"
    });
    expect(line).toBe("cp | ctx 7% ok | mem 4 | skill scoped-read | Opus 4.8");
  });

  it("includes the observation count when there are observations", () => {
    const line = formatStatusline({
      bytesRead: 50_000,
      memoryCount: 4,
      observationCount: 37,
      activeSkill: "scoped-read",
      model: "Opus 4.8"
    });
    expect(line).toBe("cp | ctx 7% ok | mem 4 | obs 37 | skill scoped-read | Opus 4.8");
  });

  it("drops the observation segment when the store is empty", () => {
    const line = formatStatusline({ bytesRead: 0, observationCount: 0 });
    expect(line).toBe("cp | ctx 0% ok");
  });

  it("drops segments with no data", () => {
    const line = formatStatusline({ bytesRead: 0 });
    expect(line).toBe("cp | ctx 0% ok");
  });

  it("shows warn when the budget crosses the comfort fraction", () => {
    const bytes = 0.7 * DEFAULT_WINDOW_TOKENS * BYTES_PER_TOKEN;
    const line = formatStatusline({ bytesRead: bytes, memoryCount: 2 });
    expect(line).toContain("warn");
    expect(line).toContain("mem 2");
  });

  it("shows COMPACT when the budget is nearly full", () => {
    const bytes = 0.95 * DEFAULT_WINDOW_TOKENS * BYTES_PER_TOKEN;
    const line = formatStatusline({ bytesRead: bytes });
    expect(line).toContain("COMPACT");
  });
});

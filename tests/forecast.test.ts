import { describe, expect, it } from "vitest";
import { forecastTokens } from "../src/budget/forecast.js";

describe("forecastTokens", () => {
  it("projects steps from a uniform history", () => {
    const r = forecastTokens({
      history: [1000, 1000, 1000, 1000, 1000],
      currentTokens: 5000,
      thresholdTokens: 15000
    });
    expect(r.avgStepTokens).toBe(1000);
    expect(r.stepsUntilCompact).toBe(10);
    expect(r.remainingTokens).toBe(10000);
  });

  it("averages only the trailing window", () => {
    const r = forecastTokens({
      history: [10000, 10000, 10000, 100, 100],
      currentTokens: 0,
      thresholdTokens: 100000,
      windowSize: 3
    });
    // Trailing three is [10000, 100, 100] = avg 3400.
    expect(r.avgStepTokens).toBe(3400);
  });

  it("returns zero steps when the threshold is already breached", () => {
    const r = forecastTokens({
      history: [500, 500],
      currentTokens: 2000,
      thresholdTokens: 1500
    });
    expect(r.stepsUntilCompact).toBe(0);
    expect(r.remainingTokens).toBe(0);
  });

  it("treats an empty history as one token per step so the result is finite", () => {
    const r = forecastTokens({
      history: [],
      currentTokens: 100,
      thresholdTokens: 200
    });
    expect(Number.isFinite(r.stepsUntilCompact)).toBe(true);
    expect(r.avgStepTokens).toBe(1);
    expect(r.stepsUntilCompact).toBe(100);
  });
});

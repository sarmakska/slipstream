import { describe, expect, it } from "vitest";
import { estimateCost, DEFAULT_USD_PER_MTOK } from "../src/context/cost.js";

describe("estimateCost", () => {
  it("converts tokens to dollars at the given rate", () => {
    const c = estimateCost(1_000_000, 3);
    expect(c.usd).toBe(3);
    expect(c.label).toContain("$3.00 saved");
    expect(c.label).toContain("$3 per million");
  });

  it("rounds to cents", () => {
    expect(estimateCost(500_000, 3).usd).toBe(1.5);
  });

  it("shows a floor label for tiny amounts", () => {
    const c = estimateCost(100, 3);
    expect(c.usd).toBe(0);
    expect(c.label).toContain("under $0.01");
  });

  it("uses the default rate when none is given", () => {
    const c = estimateCost(1_000_000);
    expect(c.usdPerMTok).toBe(DEFAULT_USD_PER_MTOK);
  });

  it("never goes negative", () => {
    expect(estimateCost(-5).usd).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  budget,
  estimateTokens,
  guardRead,
  LARGE_FILE_BYTES,
  DEFAULT_WINDOW_TOKENS
} from "../src/context/index.js";

describe("estimateTokens", () => {
  it("converts bytes to an approximate token count", () => {
    expect(estimateTokens(3600)).toBe(1000);
  });
});

describe("budget", () => {
  it("reports ok well below the comfort fraction", () => {
    const report = budget({ bytesRead: 10_000 });
    expect(report.level).toBe("ok");
    expect(report.windowTokens).toBe(DEFAULT_WINDOW_TOKENS);
  });

  it("warns between the comfort fraction and 85 percent", () => {
    // 0.7 of the window in tokens, converted back to bytes.
    const bytes = 0.7 * DEFAULT_WINDOW_TOKENS * 3.6;
    const report = budget({ bytesRead: bytes });
    expect(report.level).toBe("warn");
  });

  it("recommends compaction above 85 percent", () => {
    const bytes = 0.95 * DEFAULT_WINDOW_TOKENS * 3.6;
    const report = budget({ bytesRead: bytes });
    expect(report.level).toBe("compact");
    expect(report.advice).toContain("compaction");
    expect(report.usedFraction).toBeLessThanOrEqual(1);
  });

  it("honours a custom window", () => {
    const report = budget({ bytesRead: 100_000, windowTokens: 50_000 });
    expect(report.windowTokens).toBe(50_000);
  });
});

describe("guardRead", () => {
  it("allows a small file read", () => {
    const guard = guardRead(LARGE_FILE_BYTES - 1, "src/small.ts");
    expect(guard.allow).toBe(true);
  });

  it("flags a large whole file read and points at scoped retrieval", () => {
    const guard = guardRead(LARGE_FILE_BYTES * 4, "src/huge.ts");
    expect(guard.allow).toBe(false);
    expect(guard.recommendation).toContain("project map");
    expect(guard.approxTokens).toBeGreaterThan(0);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Hooks live as .mjs scripts; vitest's loader resolves them directly.
import { withLatencyGuard } from "../hooks/emit.mjs";

describe("withLatencyGuard", () => {
  let writes: string[] = [];
  let originalWrite: typeof process.stderr.write;

  beforeEach(() => {
    writes = [];
    originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
    delete process.env.SLIPSTREAM_HOOK_BUDGET_MS;
  });

  afterEach(() => {
    process.stderr.write = originalWrite;
  });

  it("stays silent when the handler returns within the budget", async () => {
    await withLatencyGuard("fast-hook", async () => {
      // returns immediately
    });
    expect(writes.length).toBe(0);
  });

  it("warns to stderr when the handler exceeds the budget", async () => {
    process.env.SLIPSTREAM_HOOK_BUDGET_MS = "5";
    await withLatencyGuard("slow-hook", async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
    expect(writes.length).toBe(1);
    expect(writes[0]).toContain("[slipstream] hook slow-hook took");
    expect(writes[0]).toContain("budget 5ms");
  });

  it("does not swallow a thrown error", async () => {
    process.env.SLIPSTREAM_HOOK_BUDGET_MS = "200";
    await expect(
      withLatencyGuard("boom-hook", async () => {
        throw new Error("nope");
      })
    ).rejects.toThrow("nope");
  });

  // Reference vi so it does not appear unused under strict lint configs.
  void vi;
});

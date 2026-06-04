import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { callTool } from "../src/mcp/tools.js";
import { appendEvent } from "../src/dashboard/log.js";
import { makeEvent } from "../src/dashboard/events.js";
import { budget } from "../src/context/budget.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "slipstream-digest-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

async function seedSession(root: string, session: string): Promise<void> {
  mkdirSync(join(root, ".claude", "slipstream", "dashboard"), { recursive: true });
  await appendEvent(
    root,
    makeEvent({
      session,
      agent: "main",
      kind: "post-tool",
      label: "edit src/foo.ts"
    })
  );
  await appendEvent(
    root,
    makeEvent({
      session,
      agent: "main",
      kind: "post-tool",
      label: "decided to use vitest"
    })
  );
}

describe("sp_digest", () => {
  it("builds and persists a digest, returns ok with path and token estimate", async () => {
    await seedSession(tmp, "test-session");
    const result = await callTool(
      "sp_digest",
      { session: "test-session", openTaskHint: "ship issue 3" },
      { defaultRoot: tmp }
    );
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0]!.text);
    expect(payload.ok).toBe(true);
    expect(payload.digestPath).toMatch(/session-digest-/);
    expect(payload.tokensEstimate).toBeGreaterThan(0);
    expect(payload.openTask).toBe("ship issue 3");
  });

  it("persists the digest to the memory store", async () => {
    await seedSession(tmp, "sess-2");
    await callTool("sp_digest", { session: "sess-2" }, { defaultRoot: tmp });
    const list = await callTool("sp_recall", { query: "compaction digest" }, { defaultRoot: tmp });
    expect(list.content[0]!.text).toMatch(/session-digest/);
  });
});

describe("sp_resume", () => {
  it("returns the latest digest after sp_digest has been called", async () => {
    await seedSession(tmp, "sess-3");
    await callTool("sp_digest", { session: "sess-3", openTaskHint: "the open task" }, { defaultRoot: tmp });
    const resume = await callTool("sp_resume", {}, { defaultRoot: tmp });
    const payload = JSON.parse(resume.content[0]!.text);
    expect(payload.digest).toContain("the open task");
    expect(payload.tokensEstimate).toBeGreaterThan(0);
  });

  it("returns digest:null when none has been saved", async () => {
    const resume = await callTool("sp_resume", {}, { defaultRoot: tmp });
    const payload = JSON.parse(resume.content[0]!.text);
    expect(payload.digest).toBeNull();
  });
});

describe("sp_budget recommendation", () => {
  it("has no recommendation when usedFraction is below warn", () => {
    const r = budget({
      bytesRead: 0,
      approxTokens: 1000,
      windowTokens: 100_000,
      warnFraction: 0.6,
      compactFraction: 0.85
    });
    expect(r.level).toBe("ok");
    expect(r.recommendation).toBeUndefined();
  });

  it("emits a soft recommendation between warn and compact thresholds", () => {
    const r = budget({
      bytesRead: 0,
      approxTokens: 70_000,
      windowTokens: 100_000,
      warnFraction: 0.6,
      compactFraction: 0.85
    });
    expect(r.level).toBe("warn");
    expect(r.recommendation).toBe("budget 70%, call sp_digest");
  });

  it("emits a hard recommendation above the compact threshold", () => {
    const r = budget({
      bytesRead: 0,
      approxTokens: 92_000,
      windowTokens: 100_000,
      warnFraction: 0.6,
      compactFraction: 0.85
    });
    expect(r.level).toBe("compact");
    expect(r.recommendation).toBe("budget 92%, call sp_digest now");
  });

  it("sp_budget tool surfaces the recommendation in its text output", async () => {
    // Write a budget config so the tool picks deterministic thresholds.
    mkdirSync(join(tmp, ".claude", "slipstream"), { recursive: true });
    await writeFile(
      join(tmp, ".claude", "slipstream", "budget.json"),
      JSON.stringify({ targetTokens: 100_000, warnPct: 60, compactPct: 85 }),
      "utf8"
    );
    const result = await callTool(
      "sp_budget",
      { actualTokens: 92_000 },
      { defaultRoot: tmp }
    );
    expect(result.content[0]!.text).toContain("recommendation: budget 92%, call sp_digest now");
  });
});

describe("sp_budget actualTokens override", () => {
  it("uses actualTokens instead of estimating from bytesRead", async () => {
    mkdirSync(join(tmp, ".claude", "slipstream"), { recursive: true });
    await writeFile(
      join(tmp, ".claude", "slipstream", "budget.json"),
      JSON.stringify({ targetTokens: 100_000, warnPct: 60, compactPct: 85 }),
      "utf8"
    );
    const result = await callTool(
      "sp_budget",
      { bytesRead: 0, actualTokens: 42_000 },
      { defaultRoot: tmp }
    );
    expect(result.content[0]!.text).toContain("approxTokens=42000");
  });

  it("falls back to bytesRead estimate when actualTokens absent", async () => {
    mkdirSync(join(tmp, ".claude", "slipstream"), { recursive: true });
    await writeFile(
      join(tmp, ".claude", "slipstream", "budget.json"),
      JSON.stringify({ targetTokens: 100_000, warnPct: 60, compactPct: 85 }),
      "utf8"
    );
    const result = await callTool(
      "sp_budget",
      { bytesRead: 36_000 },
      { defaultRoot: tmp }
    );
    // 36000 / 3.6 = 10000
    expect(result.content[0]!.text).toContain("approxTokens=10000");
  });
});

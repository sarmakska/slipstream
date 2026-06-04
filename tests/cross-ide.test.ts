import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadBudgetConfig,
  saveBudgetConfig,
  configToFractions,
  DEFAULT_BUDGET_CONFIG
} from "../src/context/budget-config.js";
import { sessionFromClient } from "../src/mcp/server.js";
import { contextUsageFromTranscript } from "../src/context/transcript.js";
import { summarizeSavings, recordSaving, loadSavings } from "../src/context/savings.js";
import { distillLessons } from "../src/memory/lessons.js";
import { embed } from "../src/memory/embed.js";
import type { Observation } from "../src/memory/observe.js";

describe("budget config", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "slipstream-budget-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns defaults when no file exists", async () => {
    const cfg = await loadBudgetConfig(root);
    expect(cfg).toEqual(DEFAULT_BUDGET_CONFIG);
  });

  it("saves a patch, merges over defaults and round-trips", async () => {
    const saved = await saveBudgetConfig(root, { targetTokens: 150_000, warnPct: 70 });
    expect(saved.targetTokens).toBe(150_000);
    expect(saved.warnPct).toBe(70);
    const reloaded = await loadBudgetConfig(root);
    expect(reloaded.targetTokens).toBe(150_000);
  });

  it("sanitises an inverted threshold so compact stays above warn", async () => {
    const saved = await saveBudgetConfig(root, { warnPct: 90, compactPct: 50 });
    expect(saved.compactPct).toBeGreaterThan(saved.warnPct);
  });

  it("converts percentages to the fractions budget() expects", () => {
    const fr = configToFractions({ targetTokens: 100_000, warnPct: 60, compactPct: 85 });
    expect(fr.windowTokens).toBe(100_000);
    expect(fr.warnFraction).toBeCloseTo(0.6, 5);
    expect(fr.compactFraction).toBeCloseTo(0.85, 5);
  });
});

describe("MCP session id from client", () => {
  it("derives a readable, slugged id from the client name", () => {
    const id = sessionFromClient({ clientInfo: { name: "Cursor IDE" } });
    expect(id.startsWith("cursor-ide-")).toBe(true);
  });

  it("falls back to mcp when no client name is given", () => {
    expect(sessionFromClient(undefined).startsWith("mcp-")).toBe(true);
  });
});

describe("true context from transcript", () => {
  it("sums the latest usage block into the real context size", () => {
    const lines = [
      JSON.stringify({ type: "user", message: { role: "user" } }),
      JSON.stringify({
        type: "assistant",
        message: {
          usage: {
            input_tokens: 1000,
            cache_read_input_tokens: 8000,
            cache_creation_input_tokens: 500,
            output_tokens: 200
          }
        }
      })
    ];
    const usage = contextUsageFromTranscript(lines)!;
    expect(usage.contextTokens).toBe(9700);
    expect(usage.inputTokens).toBe(1000);
  });

  it("uses the most recent usage, not an earlier one", () => {
    const lines = [
      JSON.stringify({ message: { usage: { input_tokens: 100, output_tokens: 10 } } }),
      JSON.stringify({ message: { usage: { input_tokens: 5000, output_tokens: 300 } } })
    ];
    expect(contextUsageFromTranscript(lines)!.contextTokens).toBe(5300);
  });

  it("returns null when no line carries usage", () => {
    const lines = [JSON.stringify({ type: "user" }), "not json", ""];
    expect(contextUsageFromTranscript(lines)).toBeNull();
  });
});

describe("optimization savings", () => {
  it("computes saved tokens and the percentage trimmed", () => {
    // 100k full bytes, 20k served -> 80k saved, 80% trimmed.
    const s = summarizeSavings({ scopedReads: 5, servedBytes: 20_000, fullBytes: 100_000 });
    expect(s.savedBytes).toBe(80_000);
    expect(s.pct).toBe(80);
    expect(s.savedTokens).toBe(s.fullTokens - s.servedTokens);
    expect(s.savedTokens).toBeGreaterThan(0);
  });

  it("is zero and safe on an empty tally", () => {
    const s = summarizeSavings({ scopedReads: 0, servedBytes: 0, fullBytes: 0 });
    expect(s.pct).toBe(0);
    expect(s.savedTokens).toBe(0);
  });

  it("folds records into a bounded aggregate that round-trips", async () => {
    const root = await mkdtemp(join(tmpdir(), "slipstream-savings-"));
    try {
      await recordSaving(root, { tool: "sp_symbol", file: "a.ts", servedBytes: 100, fullBytes: 500 });
      await recordSaving(root, { tool: "sp_lines", file: "b.ts", servedBytes: 50, fullBytes: 300 });
      // A read with no real baseline is ignored, not counted.
      await recordSaving(root, { tool: "sp_symbol", file: "c.ts", servedBytes: 10, fullBytes: 0 });
      const tally = await loadSavings(root);
      expect(tally.scopedReads).toBe(2);
      expect(tally.servedBytes).toBe(150);
      expect(tally.fullBytes).toBe(800);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("lesson distillation", () => {
  function obs(id: number, session: string, files: string[]): Observation {
    return {
      id,
      session,
      ts: `2026-06-04T10:0${id}:00.000Z`,
      kind: "edit",
      summary: `work ${id}`,
      detail: "",
      files,
      tags: [],
      vector: embed(files.join(" "))
    };
  }

  it("surfaces a topic touched repeatedly across sessions", () => {
    const observations = [
      obs(1, "s1", ["src/payments/webhook.ts"]),
      obs(2, "s1", ["src/payments/webhook.ts"]),
      obs(3, "s2", ["src/payments/webhook.ts"]),
      obs(4, "s2", ["src/site/hero.tsx"])
    ];
    const lessons = distillLessons(observations, { minCount: 3 });
    const webhook = lessons.find((l) => l.topic === "webhook");
    expect(webhook).toBeTruthy();
    expect(webhook!.count).toBe(3);
    expect(webhook!.sessions).toBe(2);
    expect(webhook!.observationIds).toEqual([1, 2, 3]);
  });

  it("ignores topics below the minimum count", () => {
    const observations = [obs(1, "s1", ["src/site/hero.tsx"])];
    expect(distillLessons(observations, { minCount: 3 })).toEqual([]);
  });

  it("does not cluster on structural path segments like src or index", () => {
    const observations = [
      obs(1, "s1", ["src/index.ts"]),
      obs(2, "s1", ["src/index.ts"]),
      obs(3, "s1", ["src/index.ts"])
    ];
    const topics = distillLessons(observations, { minCount: 3 }).map((l) => l.topic);
    expect(topics).not.toContain("src");
    expect(topics).not.toContain("index");
  });
});

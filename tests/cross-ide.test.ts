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

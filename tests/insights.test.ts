import { describe, expect, it } from "vitest";
import {
  liveInsights,
  projectInsights,
  journalInsights,
  sessionsInsights,
  rankSessions,
  driftStories,
  type LiveContext
} from "../src/dashboard/insights.js";
import type { Observation } from "../src/memory/observe.js";
import type { DashboardState } from "../src/dashboard/state.js";

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

function obs(partial: Partial<Observation>): Observation {
  return {
    id: partial.id ?? 1,
    session: partial.session ?? "sess0001",
    ts: partial.ts ?? "2026-06-06T12:00:00Z",
    kind: partial.kind ?? "edit",
    summary: partial.summary ?? "edited a file",
    detail: partial.detail ?? "",
    files: partial.files ?? [],
    tags: partial.tags ?? [],
    vector: partial.vector ?? [],
    skill: partial.skill,
    key: partial.key,
    claim: partial.claim,
    drift: partial.drift
  };
}

function liveState(labels: string[], session = "4f2a1234"): DashboardState {
  return {
    session,
    windowTokens: 200000,
    agents: [
      {
        id: "main",
        status: "running",
        task: "",
        approxTokens: 0,
        toolCalls: labels.length,
        activity: labels.map((label, i) => ({
          seq: i,
          ts: "2026-06-06T12:00:00Z",
          kind: "post-tool" as const,
          label
        }))
      }
    ],
    plan: [],
    lastSeq: labels.length,
    startedAt: null,
    finishedAt: null
  };
}

function ctx(over: Partial<LiveContext>): LiveContext {
  return {
    state: over.state ?? null,
    optPct: over.optPct ?? 0,
    savedTokens: over.savedTokens ?? 0,
    scopedReads: over.scopedReads ?? 0,
    budgetPct: over.budgetPct ?? 0,
    budgetLevel: over.budgetLevel ?? "ok",
    stepsUntilCompact: over.stepsUntilCompact ?? null
  };
}

// -----------------------------------------------------------------------------
// liveInsights
// -----------------------------------------------------------------------------

describe("liveInsights", () => {
  it("waits when there is no state", () => {
    const r = liveInsights(ctx({ state: null }));
    expect(r.paragraph).toContain("Waiting for the session to start");
    expect(r.bullets).toEqual([]);
  });

  it("waits when the state has no agents", () => {
    const empty = { ...liveState([]), agents: [] };
    const r = liveInsights(ctx({ state: empty }));
    expect(r.paragraph).toContain("Waiting for the session to start");
  });

  it("names the session, tool count, opt percentage and files in focus", () => {
    const state = liveState(["Edit src/auth.ts", "Read src/billing.ts", "Bash pnpm test"]);
    const r = liveInsights(ctx({ state, optPct: 72 }));
    expect(r.paragraph).toContain("Session 4f2a1234");
    expect(r.paragraph).toContain("3 tool calls");
    expect(r.paragraph).toContain("72% optimised versus whole-file");
    expect(r.paragraph).toContain("src/auth.ts");
    expect(r.paragraph).toContain("src/billing.ts");
    // "pnpm test" is not a path, so it must not be listed as a file in focus.
    expect(r.paragraph).not.toContain("pnpm test");
  });

  it("shows a near-term step runway but drops an unrealistic one", () => {
    const state = liveState(["Edit a/b.ts"]);
    expect(liveInsights(ctx({ state, stepsUntilCompact: 12 })).paragraph)
      .toContain("projected 12 steps before compact");
    expect(liveInsights(ctx({ state, stepsUntilCompact: 170000 })).paragraph)
      .not.toContain("projected");
  });

  it("warns at the warn budget level and pushes sp_digest at compact", () => {
    const state = liveState(["Edit a/b.ts"]);
    expect(liveInsights(ctx({ state, budgetLevel: "warn", budgetPct: 78 })).bullets[0])
      .toContain("warn threshold");
    const compact = liveInsights(ctx({ state, budgetLevel: "compact", budgetPct: 92 })).bullets[0];
    expect(compact).toContain("compact threshold");
    expect(compact).toContain("sp_digest");
  });

  it("reports saved tokens across scoped reads when there are any", () => {
    const state = liveState(["Edit a/b.ts"]);
    const r = liveInsights(ctx({ state, savedTokens: 12400, scopedReads: 18 }));
    const savings = r.bullets.find((b) => b.includes("scoped read"));
    expect(savings).toBeDefined();
    expect(savings).toContain("12,400");
    expect(savings).toContain("18 scoped reads");
  });
});

// -----------------------------------------------------------------------------
// projectInsights
// -----------------------------------------------------------------------------

describe("projectInsights", () => {
  it("returns an empty-state paragraph with no observations", () => {
    const r = projectInsights({
      observations: [],
      sessionCount: 0,
      memoryCount: 0,
      optPct: 0,
      savedTokens: 0,
      scopedReads: 0
    });
    expect(r.paragraph).toContain("No observations yet");
    expect(r.bullets).toEqual([]);
  });

  it("names the dominant focus directory when one stands out", () => {
    const observations = [
      ...Array.from({ length: 8 }, (_, i) => obs({ id: i + 1, files: ["src/auth/login.ts"] })),
      obs({ id: 9, files: ["src/billing/charge.ts"] }),
      obs({ id: 10, files: ["docs/readme.md"] })
    ];
    const r = projectInsights({
      observations,
      sessionCount: 2,
      memoryCount: 0,
      optPct: 70,
      savedTokens: 5000,
      scopedReads: 12
    });
    expect(r.paragraph).toContain("your focus has been src/auth");
    expect(r.paragraph).toContain("% of edits");
    expect(r.paragraph).toContain("Optimisation versus whole-file reads is running at 70%");
  });

  it("says edits are spread when no directory dominates", () => {
    const observations = Array.from({ length: 8 }, (_, i) =>
      obs({ id: i + 1, files: [`dir${i}/file.ts`] })
    );
    const r = projectInsights({
      observations,
      sessionCount: 1,
      memoryCount: 0,
      optPct: 0,
      savedTokens: 0,
      scopedReads: 0
    });
    expect(r.paragraph).toContain("edits are spread across the project");
  });

  it("mentions drift flags in the paragraph when present", () => {
    const observations = [
      obs({ id: 1, files: ["src/auth/a.ts"] }),
      obs({ id: 2, files: ["src/auth/b.ts"], drift: true })
    ];
    const r = projectInsights({
      observations,
      sessionCount: 1,
      memoryCount: 3,
      optPct: 0,
      savedTokens: 0,
      scopedReads: 0
    });
    expect(r.paragraph).toContain("1 drift flag to review");
    expect(r.bullets.some((b) => b.includes("durable memories"))).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// journalInsights
// -----------------------------------------------------------------------------

describe("journalInsights", () => {
  it("reports nothing recorded on an empty day", () => {
    const r = journalInsights("2026-06-05", [obs({ ts: "2026-06-06T12:00:00Z" })]);
    expect(r.paragraph).toBe("Nothing recorded on 2026-06-05.");
    expect(r.bullets).toEqual([]);
  });

  it("describes a real day with sessions, files and a peak window", () => {
    const observations = [
      obs({ id: 1, session: "aaa11111", ts: "2026-06-06T12:10:00Z", files: ["src/auth/a.ts"] }),
      obs({ id: 2, session: "aaa11111", ts: "2026-06-06T12:40:00Z", files: ["src/auth/a.ts"] }),
      obs({ id: 3, session: "bbb22222", ts: "2026-06-06T13:05:00Z", files: ["src/ui/b.ts"] })
    ];
    const r = journalInsights("2026-06-06", observations);
    expect(r.paragraph).toContain("On 2026-06-06");
    expect(r.paragraph).toContain("3 observations across 2 sessions");
    expect(r.paragraph).toContain("Activity concentrated on");
    expect(r.paragraph).toMatch(/Peak activity .* UTC/);
    expect(r.bullets.some((b) => b.startsWith("Session aaa11111"))).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// sessionsInsights and rankSessions
// -----------------------------------------------------------------------------

describe("rankSessions", () => {
  it("flags hot above 2x and quiet at or below a quarter of the average", () => {
    const observations = [
      ...Array.from({ length: 8 }, (_, i) => obs({ id: i + 1, session: "hot" })),
      obs({ id: 9, session: "mid" }),
      obs({ id: 10, session: "mid" })
    ];
    const rows = rankSessions(observations, ["hot", "mid", "quiet"]);
    const byId = Object.fromEntries(rows.map((r) => [r.session, r]));
    expect(byId.hot.flag).toBe("hot");
    expect(byId.hot.ratio).toBeGreaterThanOrEqual(2);
    expect(byId.mid.flag).toBe("normal");
    expect(byId.quiet.observationCount).toBe(0);
    expect(byId.quiet.flag).toBe("quiet");
    // Sorted hottest first.
    expect(rows[0].session).toBe("hot");
  });

  it("returns nothing for no sessions", () => {
    expect(rankSessions([], [])).toEqual([]);
  });
});

describe("sessionsInsights", () => {
  it("returns an empty-state paragraph with no sessions", () => {
    const r = sessionsInsights([], []);
    expect(r.paragraph).toBe("No sessions recorded yet.");
  });

  it("calls out heavy and quiet sessions", () => {
    const observations = [
      ...Array.from({ length: 8 }, (_, i) => obs({ id: i + 1, session: "hot" })),
      obs({ id: 9, session: "mid" }),
      obs({ id: 10, session: "mid" })
    ];
    const r = sessionsInsights(observations, ["hot", "mid", "quiet"]);
    expect(r.paragraph).toContain("3 sessions recorded");
    expect(r.paragraph).toContain("stands out");
    expect(r.bullets.some((b) => b.startsWith("Heavy: hot"))).toBe(true);
    expect(r.bullets.some((b) => b.startsWith("Quiet: quiet"))).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// driftStories
// -----------------------------------------------------------------------------

describe("driftStories", () => {
  it("produces one story per drifting observation and ignores the rest", () => {
    const observations = [
      obs({ id: 14, session: "4f2a1234", files: ["src/auth.ts"], drift: true, claim: "JWT only" }),
      obs({ id: 15, session: "4f2a1234", files: ["src/ui.ts"] })
    ];
    const stories = driftStories(observations);
    expect(stories).toHaveLength(1);
    expect(stories[0].id).toBe(14);
    expect(stories[0].story).toContain("auth.ts");
    expect(stories[0].story).toContain("contradicts observation");
  });

  it("returns no stories when nothing drifts", () => {
    expect(driftStories([obs({ id: 1 }), obs({ id: 2 })])).toEqual([]);
  });
});

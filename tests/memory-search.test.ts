import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { embed, cosine, tokenize, EMBED_DIM } from "../src/memory/embed.js";
import {
  foldObservations,
  captureObservations,
  loadObservations,
  getObservations,
  type Observation
} from "../src/memory/observe.js";
import {
  rankObservations,
  searchObservations,
  timeline
} from "../src/memory/search.js";
import type { DashboardEvent } from "../src/dashboard/events.js";

describe("local embedding", () => {
  it("produces a unit-length vector of the fixed dimension", () => {
    const v = embed("stripe webhook signature verification");
    expect(v.length).toBe(EMBED_DIM);
    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(mag).toBeCloseTo(1, 5);
  });

  it("is deterministic: same text, same vector", () => {
    expect(embed("row level security")).toEqual(embed("row level security"));
  });

  it("ranks a related text above an unrelated one by cosine", () => {
    const q = embed("supabase row level security policy");
    const related = embed("added an RLS policy on the orders table in supabase");
    const unrelated = embed("tuned the css grid layout of the landing hero");
    expect(cosine(q, related)).toBeGreaterThan(cosine(q, unrelated));
  });

  it("returns a zero vector for empty or all-stopword input", () => {
    const v = embed("the and for with");
    expect(v.every((x) => x === 0)).toBe(true);
  });

  it("splits camelCase and snake_case identifiers into words", () => {
    expect(tokenize("retrieveSymbol max_files")).toEqual([
      "retrieve",
      "symbol",
      "max",
      "files"
    ]);
  });
});

/** Build a minimal valid event for the fold tests. */
function ev(
  seq: number,
  kind: DashboardEvent["kind"],
  label: string,
  data?: Record<string, unknown>
): DashboardEvent {
  return {
    seq,
    ts: `2026-06-04T10:${String(seq).padStart(2, "0")}:00.000Z`,
    session: "s1",
    agent: "main",
    kind,
    label,
    data
  };
}

describe("foldObservations", () => {
  it("turns a prompt+tools+stop turn into one observation", () => {
    const events = [
      ev(0, "session-start", "session started"),
      ev(1, "user-prompt", "fix the stripe webhook"),
      ev(2, "post-tool", "Read src/pay/webhook.ts"),
      ev(3, "post-tool", "Edit src/pay/webhook.ts"),
      ev(4, "stop", "turn finished")
    ];
    const { observations, consumedThroughSeq } = foldObservations(events, 1);
    expect(observations.length).toBe(1);
    const o = observations[0]!;
    expect(o.id).toBe(1);
    expect(o.kind).toBe("edit");
    expect(o.files).toContain("src/pay/webhook.ts");
    expect(o.summary).toContain("stripe webhook");
    expect(consumedThroughSeq).toBe(4);
  });

  it("leaves an unterminated trailing turn unconsumed for next time", () => {
    const events = [
      ev(1, "user-prompt", "first task"),
      ev(2, "post-tool", "Edit a.ts"),
      ev(3, "stop", "turn finished"),
      ev(4, "user-prompt", "second task in progress"),
      ev(5, "post-tool", "Read b.ts")
    ];
    const { observations, consumedThroughSeq } = foldObservations(events, 10);
    // Only the first (closed) turn becomes an observation.
    expect(observations.length).toBe(1);
    expect(observations[0]!.id).toBe(10);
    // The cursor stops before the open second turn so it is reprocessed later.
    expect(consumedThroughSeq).toBe(3);
  });

  it("classifies a command-only turn as a command", () => {
    const events = [
      ev(1, "user-prompt", "run the migration"),
      ev(2, "post-tool", "Bash psql -f m.sql"),
      ev(3, "stop", "done")
    ];
    const o = foldObservations(events, 1).observations[0]!;
    expect(o.kind).toBe("command");
  });
});

describe("observation store IO", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "slipstream-obs-"));
    const dir = join(root, ".claude", "slipstream", "dashboard");
    await mkdir(dir, { recursive: true });
    const log = [
      ev(0, "session-start", "session started"),
      ev(1, "user-prompt", "fix the stripe webhook signature verification"),
      ev(2, "post-tool", "Read src/payments/webhook.ts"),
      ev(3, "post-tool", "Edit src/payments/webhook.ts"),
      ev(4, "stop", "turn finished"),
      ev(5, "user-prompt", "add a supabase row level security policy for orders"),
      ev(6, "post-tool", "Write supabase/migrations/002_rls.sql"),
      ev(7, "post-tool", "Bash psql -f migration"),
      ev(8, "stop", "turn finished")
    ]
      .map((e) => JSON.stringify(e))
      .join("\n");
    await writeFile(join(dir, "s1.jsonl"), log + "\n", "utf8");
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("captures observations from the event log and is idempotent", async () => {
    const first = await captureObservations(root, "s1");
    expect(first.length).toBe(2);
    expect(first.map((o) => o.id)).toEqual([1, 2]);
    // Re-running captures nothing new thanks to the cursor.
    const second = await captureObservations(root, "s1");
    expect(second.length).toBe(0);
    const all = await loadObservations(root);
    expect(all.length).toBe(2);
  });

  it("assigns project-wide monotonic ids and fetches by id in request order", async () => {
    await captureObservations(root, "s1");
    const got = await getObservations(root, [2, 1]);
    expect(got.map((o) => o.id)).toEqual([2, 1]);
    expect(got[0]!.summary).toContain("supabase");
  });
});

describe("three-layer search", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "slipstream-search-"));
    const dir = join(root, ".claude", "slipstream", "dashboard");
    await mkdir(dir, { recursive: true });
    const log = [
      ev(0, "session-start", "session started"),
      ev(1, "user-prompt", "fix the stripe webhook signature verification"),
      ev(2, "post-tool", "Edit src/payments/webhook.ts"),
      ev(3, "stop", "turn finished"),
      ev(4, "user-prompt", "add a supabase row level security policy for orders"),
      ev(5, "post-tool", "Write supabase/migrations/002_rls.sql"),
      ev(6, "stop", "turn finished"),
      ev(7, "user-prompt", "polish the landing hero animation"),
      ev(8, "post-tool", "Edit src/site/hero.tsx"),
      ev(9, "stop", "turn finished")
    ]
      .map((e) => JSON.stringify(e))
      .join("\n");
    await writeFile(join(dir, "s1.jsonl"), log + "\n", "utf8");
    await captureObservations(root, "s1");
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("layer 1: ranks the most relevant observation first", async () => {
    const hits = await searchObservations(root, { query: "stripe webhook" });
    expect(hits[0]!.summary).toContain("stripe webhook");
  });

  it("layer 1: filters by kind", async () => {
    const hits = await searchObservations(root, { query: "policy", kind: "edit" });
    expect(hits.every((h) => h.kind === "edit")).toBe(true);
  });

  it("layer 2: timeline centres on the best match and flags the anchor", async () => {
    const entries = await timeline(root, { around: "row level security", window: 1 });
    const anchor = entries.find((e) => e.anchor)!;
    expect(anchor.summary).toContain("supabase");
  });

  it("layer 3 cost discipline: the index never carries the full detail", async () => {
    const hits = await searchObservations(root, { query: "webhook" });
    // A compact hit has a summary but no detail field at all.
    expect((hits[0] as unknown as { detail?: string }).detail).toBeUndefined();
  });

  it("ranking puts an exact-term match above a merely-similar one", () => {
    const obs: Observation[] = [
      {
        id: 1,
        session: "s1",
        ts: "2026-06-04T10:00:00.000Z",
        kind: "edit",
        summary: "stripe webhook signature fix",
        detail: "",
        files: [],
        tags: ["webhook"],
        vector: embed("stripe webhook signature fix")
      },
      {
        id: 2,
        session: "s1",
        ts: "2026-06-04T10:01:00.000Z",
        kind: "edit",
        summary: "payment provider callback handling",
        detail: "",
        files: [],
        tags: ["payment"],
        vector: embed("payment provider callback handling")
      }
    ];
    const ranked = rankObservations(obs, { query: "webhook signature" });
    expect(ranked[0]!.id).toBe(1);
  });
});

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDigest,
  digestToMarkdown,
  digestToMemory,
  digestMemoryName
} from "../src/memory/digest.js";
import { addMemory, listMemories } from "../src/memory/store.js";
import { selectRelevant } from "../src/memory/recall.js";

const sampleEvent = {
  session: "sess-123",
  trigger: "auto" as const,
  activity: [
    "session started",
    "read src/payments/stripe.ts",
    "decided to use the raw request body for webhook verification because the parsed body breaks the signature",
    "edited src/payments/webhook.ts"
  ],
  filesTouched: ["src/payments/stripe.ts", "src/payments/webhook.ts"],
  openTaskHint: "Wire the Stripe webhook handler and verify signatures"
};

describe("buildDigest", () => {
  it("captures the open task, decisions, files and a next step", () => {
    const d = buildDigest(sampleEvent);
    expect(d.openTask).toBe("Wire the Stripe webhook handler and verify signatures");
    expect(d.decisions.some((x) => x.includes("raw request body"))).toBe(true);
    expect(d.filesTouched).toContain("src/payments/webhook.ts");
    expect(d.nextSteps.length).toBeGreaterThan(0);
    expect(d.trigger).toBe("auto");
  });

  it("falls back to the last activity line when no open-task hint is given", () => {
    const d = buildDigest({ ...sampleEvent, openTaskHint: undefined });
    expect(d.openTask).toContain("edited src/payments/webhook.ts");
  });

  it("dedupes files and bounds the lists", () => {
    const d = buildDigest({
      session: "s",
      filesTouched: ["a.ts", "a.ts", "b.ts"],
      activity: []
    });
    expect(d.filesTouched).toEqual(["a.ts", "b.ts"]);
  });
});

describe("digestToMarkdown", () => {
  it("renders a structured, readable digest body", () => {
    const md = digestToMarkdown(buildDigest(sampleEvent));
    expect(md).toContain("**Open task:**");
    expect(md).toContain("**Decisions made:**");
    expect(md).toContain("**Files touched:**");
    expect(md).toContain("**Next steps:**");
  });
});

describe("digest persistence and reload (lossless compaction)", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "slipstream-digest-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes the digest to the store and reloads it on the next session signal", async () => {
    const d = buildDigest(sampleEvent);
    const saved = await addMemory(root, digestToMemory(d));
    expect(saved.name).toBe(digestMemoryName(sampleEvent.session));

    // The next session, working on a stripe branch, must surface the digest.
    const all = await listMemories(root);
    expect(all).toHaveLength(1);
    const hits = selectRelevant(all, { branch: "fix/stripe-webhook" });
    expect(hits[0]?.memory.name).toBe(saved.name);
    expect(hits[0]?.memory.body).toContain("raw request body");
  });
});

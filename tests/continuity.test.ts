import { describe, expect, it } from "vitest";
import { resumeBrief } from "../src/memory/continuity.js";
import type { Conversation } from "../src/memory/conversation.js";
import type { Observation } from "../src/memory/observe.js";

function conv(asks: string[]): Conversation {
  return {
    session: "s",
    turnCount: asks.length,
    exchanges: asks.map((ask, i) => ({ ask, replyChars: 5, tools: [], ts: `2026-06-06T12:0${i}:00Z`, summary: ask }))
  };
}

function obs(files: string[], ts: string): Observation {
  return { id: 1, session: "s", ts, kind: "edit", summary: "x", detail: "", files, tags: [], vector: [] };
}

describe("resumeBrief", () => {
  it("reports no context when there is nothing to resume", () => {
    const b = resumeBrief(null, []);
    expect(b.hasContext).toBe(false);
    expect(b.openThread).toBe("");
    expect(b.suggestedNext).toContain("No prior context");
  });

  it("uses the last ask as the open thread and suggested next", () => {
    const b = resumeBrief(conv(["first", "the live thread"]), []);
    expect(b.hasContext).toBe(true);
    expect(b.openThread).toBe("the live thread");
    expect(b.suggestedNext).toContain("the live thread");
    expect(b.recentAsks[0]).toBe("the live thread");
  });

  it("lists files in flight newest first from observations", () => {
    const b = resumeBrief(null, [
      obs(["src/old.ts"], "2026-06-06T10:00:00Z"),
      obs(["src/new.ts"], "2026-06-06T14:00:00Z")
    ]);
    expect(b.filesInFlight[0]).toBe("src/new.ts");
    expect(b.lastActive).toBe("2026-06-06T14:00:00Z");
    expect(b.suggestedNext).toContain("src/new.ts");
  });

  it("falls back to files when there are observations but no asks", () => {
    const b = resumeBrief(null, [obs(["src/x.ts"], "2026-06-06T12:00:00Z")]);
    expect(b.hasContext).toBe(true);
    expect(b.suggestedNext).toContain("files in flight");
  });
});

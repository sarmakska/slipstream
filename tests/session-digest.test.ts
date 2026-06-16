import { describe, expect, it } from "vitest";
import { sessionDigest } from "../src/dashboard/digest.js";
import type { Story, StoryLane } from "../src/dashboard/story.js";

function lane(partial: Partial<StoryLane>): StoryLane {
  return {
    index: 0,
    ts: "2026-06-16T00:00:00Z",
    prompt: "",
    opening: false,
    actions: [],
    files: [],
    toolCount: 0,
    delegated: false,
    summary: "",
    ...partial
  };
}

function story(lanes: StoryLane[], extra: Partial<Story> = {}): Story {
  return { session: "s1", lanes, promptCount: lanes.filter((l) => !l.opening && l.prompt).length, toolCount: 0, ...extra };
}

describe("sessionDigest", () => {
  it("synthesises a paragraph with prompt, summaries and file footprint", () => {
    const s = story(
      [
        lane({ opening: true, summary: "set up the session" }),
        lane({ index: 1, prompt: "redesign the dashboard", summary: "rebuilt the Pulse view", files: ["web/src/pulse.tsx", "web/src/App.tsx"] }),
        lane({ index: 2, prompt: "now fix sessions", summary: "added the digest synthesiser", files: ["src/dashboard/digest.ts"] })
      ],
      { toolCount: 7 }
    );
    const d = sessionDigest(s);
    expect(d.session).toBe("s1");
    expect(d.paragraph).toContain("redesign the dashboard");
    expect(d.paragraph).toContain("rebuilt the Pulse view");
    expect(d.paragraph).toContain("Across 2 prompts");
    expect(d.paragraph).toContain("3 files");
    expect(d.stats).toEqual({ prompts: 2, tools: 7, files: 3, exchanges: 2 });
  });

  it("does not dump every action — caps summaries at three", () => {
    const lanes = Array.from({ length: 6 }, (_, i) =>
      lane({ index: i + 1, prompt: `step ${i}`, summary: `did thing ${i}` })
    );
    const d = sessionDigest(story(lanes));
    expect(d.paragraph).toContain("did thing 0");
    expect(d.paragraph).toContain("did thing 2");
    expect(d.paragraph).not.toContain("did thing 3");
  });

  it("degrades to a calm line for an empty session", () => {
    const d = sessionDigest(story([lane({ opening: true })]));
    expect(d.paragraph).toBe("Nothing was recorded in this session yet.");
    expect(d.stats.prompts).toBe(0);
  });
});

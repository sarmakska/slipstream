import { describe, expect, it } from "vitest";
import { storyFlow } from "../src/dashboard/story.js";
import type { DashboardEvent } from "../src/dashboard/events.js";

let seq = 0;
function ev(partial: Partial<DashboardEvent>): DashboardEvent {
  return {
    seq: partial.seq ?? seq++,
    ts: partial.ts ?? "2026-06-06T12:00:00Z",
    session: partial.session ?? "4f2a1234",
    agent: partial.agent ?? "main",
    kind: partial.kind ?? "post-tool",
    label: partial.label ?? "",
    data: partial.data
  };
}

describe("storyFlow", () => {
  it("returns an empty story for no events", () => {
    const s = storyFlow([]);
    expect(s.lanes).toEqual([]);
    expect(s.promptCount).toBe(0);
    expect(s.toolCount).toBe(0);
    expect(s.session).toBe("");
  });

  it("opens a synthetic lane for activity before the first prompt", () => {
    seq = 0;
    const s = storyFlow([
      ev({ kind: "session-start", label: "session started" }),
      ev({ kind: "post-tool", label: "Read src/a.ts" })
    ]);
    expect(s.lanes).toHaveLength(1);
    expect(s.lanes[0].opening).toBe(true);
    expect(s.lanes[0].prompt).toBe("");
    expect(s.lanes[0].actions).toHaveLength(1);
  });

  it("groups agent actions under the prompt that preceded them", () => {
    seq = 0;
    const s = storyFlow([
      ev({ kind: "session-start", label: "session started" }),
      ev({ kind: "user-prompt", label: "ship the insights band" }),
      ev({ kind: "post-tool", label: "Edit src/dashboard/insights.ts" }),
      ev({ kind: "pre-tool", label: "Read src/dashboard/server.ts" }),
      ev({ kind: "post-tool", label: "Edit src/dashboard/server.ts" }),
      ev({ kind: "user-prompt", label: "now fix the prose" }),
      ev({ kind: "post-tool", label: "Edit src/dashboard/insights.ts" }),
      ev({ kind: "stop", label: "stop" })
    ]);
    expect(s.promptCount).toBe(2);
    expect(s.lanes).toHaveLength(2);

    const first = s.lanes[0];
    expect(first.prompt).toBe("ship the insights band");
    expect(first.opening).toBe(false);
    // pre-tool is skipped; only the two post-tool actions count.
    expect(first.toolCount).toBe(2);
    expect(first.files).toEqual(["src/dashboard/insights.ts", "src/dashboard/server.ts"]);

    const second = s.lanes[1];
    expect(second.prompt).toBe("now fix the prose");
    expect(second.toolCount).toBe(1);
  });

  it("counts a session total across lanes", () => {
    seq = 0;
    const s = storyFlow([
      ev({ kind: "user-prompt", label: "a" }),
      ev({ kind: "post-tool", label: "Read x/y.ts" }),
      ev({ kind: "post-tool", label: "Edit x/y.ts" }),
      ev({ kind: "user-prompt", label: "b" }),
      ev({ kind: "post-tool", label: "Bash pnpm test" })
    ]);
    expect(s.toolCount).toBe(3);
  });

  it("flags delegation when a subagent starts in a lane", () => {
    seq = 0;
    const s = storyFlow([
      ev({ kind: "user-prompt", label: "research the options" }),
      ev({ kind: "subagent-start", agent: "sub-1", label: "Task explore the codebase" })
    ]);
    expect(s.lanes[0].delegated).toBe(true);
    expect(s.lanes[0].summary).toContain("subagent was dispatched");
  });

  it("writes a prose summary naming the dominant verb and files", () => {
    seq = 0;
    const s = storyFlow([
      ev({ kind: "user-prompt", label: "edit things" }),
      ev({ kind: "post-tool", label: "Edit src/a.ts" }),
      ev({ kind: "post-tool", label: "Edit src/b.ts" }),
      ev({ kind: "post-tool", label: "Read src/c.ts" })
    ]);
    const summary = s.lanes[0].summary;
    expect(summary).toContain("3 tool calls");
    expect(summary).toContain("edited");
    expect(summary).toContain("a.ts");
  });

  it("summarises an empty lane as no tool calls", () => {
    seq = 0;
    const s = storyFlow([ev({ kind: "user-prompt", label: "just thinking out loud" })]);
    expect(s.lanes[0].summary).toBe("No tool calls yet.");
    expect(s.lanes[0].files).toEqual([]);
  });

  it("sorts by seq before folding so out-of-order logs still read correctly", () => {
    const s = storyFlow([
      ev({ seq: 3, kind: "post-tool", label: "Edit src/b.ts" }),
      ev({ seq: 1, kind: "user-prompt", label: "do the thing" }),
      ev({ seq: 2, kind: "post-tool", label: "Edit src/a.ts" })
    ]);
    expect(s.lanes).toHaveLength(1);
    expect(s.lanes[0].files).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

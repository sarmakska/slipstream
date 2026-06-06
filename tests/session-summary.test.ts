import { describe, expect, it } from "vitest";
import { summariseSession } from "../src/memory/session-summary.js";
import type { Conversation } from "../src/memory/conversation.js";
import type { Observation } from "../src/memory/observe.js";

function conv(asks: { ask: string; tools: string[] }[]): Conversation {
  return {
    session: "4f2a1234",
    turnCount: asks.length * 2,
    exchanges: asks.map((a) => ({ ask: a.ask, replyChars: 10, tools: a.tools, ts: "2026-06-06T12:00:00Z", summary: a.ask }))
  };
}

function obs(files: string[]): Observation {
  return {
    id: 1, session: "4f2a1234", ts: "2026-06-06T12:00:00Z", kind: "edit",
    summary: "x", detail: "", files, tags: [], vector: []
  };
}

describe("summariseSession", () => {
  it("produces a stable name and a fact type", () => {
    const s = summariseSession("4f2a1234abcd", conv([{ ask: "do a thing", tools: ["Edit"] }]), [obs(["src/a.ts"])]);
    expect(s.name).toBe("session-summary-4f2a1234");
    expect(s.type).toBe("fact");
    expect(s.tags).toContain("session-summary");
    expect(s.tags).toContain("continuity");
  });

  it("lists the asks, the files in focus and the tools in the body", () => {
    const s = summariseSession(
      "4f2a1234",
      conv([{ ask: "add a flow tab", tools: ["Edit", "Bash"] }, { ask: "now release it", tools: ["Bash"] }]),
      [obs(["src/dashboard/ui.ts"]), obs(["src/dashboard/ui.ts"]), obs(["src/dashboard/server.ts"])]
    );
    expect(s.body).toContain("## Asked");
    expect(s.body).toContain("add a flow tab");
    expect(s.body).toContain("now release it");
    expect(s.body).toContain("Files in focus");
    expect(s.body).toContain("dashboard/ui.ts");
    expect(s.body).toContain("Edit, Bash");
  });

  it("records the last ask as the open thread and in the description", () => {
    const s = summariseSession("4f2a1234", conv([{ ask: "first", tools: [] }, { ask: "the latest ask", tools: [] }]), []);
    expect(s.body).toContain("## Open thread");
    expect(s.body).toContain("the latest ask");
    expect(s.description).toContain("the latest ask");
  });

  it("handles a session with no conversation, falling back to observations", () => {
    const s = summariseSession("4f2a1234", null, [obs(["src/x.ts"])]);
    expect(s.body).toContain("## Built");
    expect(s.body).toContain("1 observation");
    expect(s.body).not.toContain("## Asked");
    expect(s.description).toContain("session 4f2a1234");
  });
});

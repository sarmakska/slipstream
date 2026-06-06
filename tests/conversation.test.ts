import { describe, expect, it } from "vitest";
import { buildConversation } from "../src/memory/conversation.js";
import type { TranscriptTurn } from "../src/memory/transcript.js";

const t = (role: "user" | "assistant", text: string, tools: string[] = []): TranscriptTurn =>
  ({ role, text, tools, ts: "2026-06-06T12:00:00Z" });

describe("buildConversation", () => {
  it("groups turns into exchanges with a summary", () => {
    const conv = buildConversation("sess1", [
      t("user", "add a flow tab"),
      t("assistant", "done", ["Edit", "Bash"]),
      t("user", "now release")
    ]);
    expect(conv.session).toBe("sess1");
    expect(conv.exchanges).toHaveLength(2);
    expect(conv.exchanges[0]!.ask).toBe("add a flow tab");
    expect(conv.exchanges[0]!.tools).toEqual(["Edit", "Bash"]);
    expect(conv.exchanges[0]!.summary).toContain("add a flow tab");
    expect(conv.exchanges[0]!.summary).toContain("Edit, Bash");
  });

  it("accumulates reply length and dedupes tools across assistant turns", () => {
    const conv = buildConversation("s", [
      t("user", "do it"),
      t("assistant", "first", ["Edit"]),
      t("assistant", "second", ["Edit", "Bash"])
    ]);
    expect(conv.exchanges[0]!.replyChars).toBe("first".length + "second".length);
    expect(conv.exchanges[0]!.tools).toEqual(["Edit", "Bash"]);
  });

  it("trims a long ask to a first sentence in the summary", () => {
    const conv = buildConversation("s", [
      t("user", "Fix the bug. Then also refactor everything and add docs and tests.")
    ]);
    expect(conv.exchanges[0]!.summary.startsWith("Fix the bug.")).toBe(true);
  });

  it("counts turns and handles an empty transcript", () => {
    expect(buildConversation("s", []).exchanges).toEqual([]);
    expect(buildConversation("s", []).turnCount).toBe(0);
    expect(buildConversation("s", [t("user", "hi"), t("assistant", "yo")]).turnCount).toBe(2);
  });

  it("ignores assistant turns with no preceding user turn", () => {
    const conv = buildConversation("s", [t("assistant", "orphan", ["Read"])]);
    expect(conv.exchanges).toEqual([]);
  });
});

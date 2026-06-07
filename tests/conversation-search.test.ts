import { describe, expect, it } from "vitest";
import { searchConversations } from "../src/memory/conversation-search.js";
import type { Conversation } from "../src/memory/conversation.js";

function conv(session: string, asks: string[]): Conversation {
  return {
    session,
    turnCount: asks.length,
    exchanges: asks.map((ask, i) => ({ ask, replyChars: 5, tools: [], ts: `2026-06-06T12:0${i}:00Z`, summary: ask }))
  };
}

describe("searchConversations", () => {
  it("returns nothing for an empty query", () => {
    expect(searchConversations([conv("s", ["build the auth flow"])], "")).toEqual([]);
  });

  it("finds the exchange that mentions the query terms", () => {
    const hits = searchConversations([
      conv("s1", ["build the auth flow", "add a dashboard chart"]),
      conv("s2", ["fix the billing bug"])
    ], "auth");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.ask).toBe("build the auth flow");
    expect(hits[0]!.session).toBe("s1");
  });

  it("ranks a fuller term match higher", () => {
    const hits = searchConversations([
      conv("s", ["add dark mode", "add dark mode toggle to the settings page"])
    ], "dark mode toggle settings");
    expect(hits[0]!.ask).toContain("toggle to the settings");
  });

  it("gives an exact phrase a bonus", () => {
    const hits = searchConversations([
      conv("s", ["the token budget gauge", "budget and token, separate words"])
    ], "token budget");
    expect(hits[0]!.ask).toBe("the token budget gauge");
  });

  it("ranks a whole-word hit above an incidental substring", () => {
    const hits = searchConversations([
      conv("s", ["rename the author column", "wire up the auth flow"])
    ], "auth");
    // "auth" is a whole word in the second ask but only a substring of
    // "author" in the first, so the real word hit must rank first.
    expect(hits[0]!.ask).toBe("wire up the auth flow");
    expect(hits).toHaveLength(2);
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);
  });

  it("still surfaces a substring-only match", () => {
    const hits = searchConversations([
      conv("s", ["refactor the authenticator module"])
    ], "auth");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.score).toBeLessThan(1);
  });

  it("respects the limit", () => {
    const asks = Array.from({ length: 10 }, (_, i) => `auth task ${i}`);
    const hits = searchConversations([conv("s", asks)], "auth", 3);
    expect(hits).toHaveLength(3);
  });
});

import { describe, expect, it } from "vitest";
import { parseInbox, pendingMessages } from "../src/memory/inbox.js";

describe("parseInbox", () => {
  it("parses JSONL messages and defaults delivered to false", () => {
    const jsonl = [
      JSON.stringify({ ts: "t1", text: "first" }),
      JSON.stringify({ ts: "t2", text: "second", delivered: true })
    ].join("\n");
    const msgs = parseInbox(jsonl);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toEqual({ ts: "t1", text: "first", delivered: false });
    expect(msgs[1]!.delivered).toBe(true);
  });

  it("skips blank and malformed lines and entries with no text", () => {
    const jsonl = ["", "not json", JSON.stringify({ ts: "t", delivered: false }), JSON.stringify({ text: "ok" })].join("\n");
    const msgs = parseInbox(jsonl);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.text).toBe("ok");
  });
});

describe("pendingMessages", () => {
  it("returns only undelivered messages", () => {
    const pending = pendingMessages([
      { ts: "1", text: "a", delivered: false },
      { ts: "2", text: "b", delivered: true },
      { ts: "3", text: "c", delivered: false }
    ]);
    expect(pending.map((m) => m.text)).toEqual(["a", "c"]);
  });

  it("returns an empty array when all are delivered", () => {
    expect(pendingMessages([{ ts: "1", text: "a", delivered: true }])).toEqual([]);
  });
});

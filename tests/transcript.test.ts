import { describe, expect, it } from "vitest";
import { parseTranscript } from "../src/memory/transcript.js";

describe("parseTranscript", () => {
  it("normalises user and assistant turns with text and tools", () => {
    const jsonl = [
      JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text: "ship it" }] }, timestamp: "2026-06-06T12:00:00Z" }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "on it" }, { type: "tool_use", name: "Edit", input: { file_path: "a.ts" } }] }, timestamp: "2026-06-06T12:00:01Z" }),
      JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", content: "ok" }] }, timestamp: "2026-06-06T12:00:02Z" })
    ].join("\n");
    const turns = parseTranscript(jsonl);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ role: "user", text: "ship it" });
    expect(turns[1]).toMatchObject({ role: "assistant", text: "on it", tools: ["Edit"] });
  });

  it("returns an empty array for empty or malformed input", () => {
    expect(parseTranscript("")).toEqual([]);
    expect(parseTranscript("not json\n{bad")).toEqual([]);
  });

  it("joins multiple text blocks in one message", () => {
    const jsonl = JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "one" }, { type: "text", text: "two" }] }, timestamp: "t" });
    expect(parseTranscript(jsonl)[0]!.text).toBe("one\ntwo");
  });

  it("treats a string content body as a single text block", () => {
    const jsonl = JSON.stringify({ type: "user", message: { role: "user", content: "plain string" }, timestamp: "t" });
    const turns = parseTranscript(jsonl);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.text).toBe("plain string");
  });

  it("drops user records that carry only a tool_result", () => {
    const jsonl = JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", content: "done" }] }, timestamp: "t" });
    expect(parseTranscript(jsonl)).toEqual([]);
  });
});

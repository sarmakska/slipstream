import { describe, expect, it } from "vitest";
import { parseBus, othersRecent, renderBus } from "../src/memory/bus.js";

describe("parseBus", () => {
  it("parses entries and defaults missing fields", () => {
    const jsonl = [JSON.stringify({ session: "a", ts: "t1", thread: "auth", files: ["x.ts"] }), "bad", JSON.stringify({ session: "b" })].join("\n");
    const e = parseBus(jsonl);
    expect(e).toHaveLength(2);
    expect(e[0]).toEqual({ session: "a", ts: "t1", thread: "auth", files: ["x.ts"] });
    expect(e[1]!.files).toEqual([]);
  });
});

describe("othersRecent", () => {
  it("keeps the latest entry per other session, newest first, excluding self", () => {
    const e = parseBus([
      JSON.stringify({ session: "self", ts: "t5", thread: "mine" }),
      JSON.stringify({ session: "a", ts: "t1", thread: "old a" }),
      JSON.stringify({ session: "a", ts: "t3", thread: "new a" }),
      JSON.stringify({ session: "b", ts: "t4", thread: "b work" })
    ].join("\n"));
    const r = othersRecent(e, "self");
    expect(r.map((x) => x.session)).toEqual(["b", "a"]);
    expect(r.find((x) => x.session === "a")!.thread).toBe("new a");
  });

  it("drops sessions with no thread and no files", () => {
    const e = parseBus([JSON.stringify({ session: "a", ts: "t1", thread: "", files: [] })].join("\n"));
    expect(othersRecent(e, "self")).toEqual([]);
  });

  it("does not self-filter generic fallback ids, so coordination never shows nothing", () => {
    // Two tabs both fall back to "main"; the reader must still see the bus.
    const e = parseBus([JSON.stringify({ session: "main", ts: "t1", thread: "building x" })].join("\n"));
    expect(othersRecent(e, "main").length).toBe(1);
  });
});

describe("renderBus", () => {
  it("renders a coordination note naming the other sessions", () => {
    const e = parseBus([
      JSON.stringify({ session: "abcd1234", ts: "t1", thread: "build the auth flow", files: ["src/auth.ts"] })
    ].join("\n"));
    const note = renderBus(e, "self");
    expect(note).toContain("Other slipstream sessions");
    expect(note).toContain("abcd1234");
    expect(note).toContain("build the auth flow");
    expect(note).toContain("src/auth.ts");
  });

  it("is empty when no other sessions are active", () => {
    expect(renderBus([], "self")).toBe("");
  });
});

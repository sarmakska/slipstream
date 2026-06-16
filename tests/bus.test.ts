import { describe, expect, it } from "vitest";
import { parseBus, othersRecent, renderBus, heartbeatEntry } from "../src/memory/bus.js";

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

  it("with a recency window, keeps active tabs and drops stale ones", () => {
    const now = new Date("2026-06-17T12:00:00Z").getTime();
    const e = parseBus([
      JSON.stringify({ session: "live", ts: new Date(now - 2 * 60_000).toISOString(), thread: "on it" }),
      JSON.stringify({ session: "stale", ts: new Date(now - 90 * 60_000).toISOString(), thread: "long gone" })
    ].join("\n"));
    const r = othersRecent(e, "self", { withinMs: 20 * 60_000, nowMs: now });
    expect(r.map((x) => x.session)).toEqual(["live"]);
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

  it("omits tabs that have gone quiet beyond the coordination window", () => {
    const now = new Date("2026-06-17T12:00:00Z").getTime();
    const e = parseBus([
      JSON.stringify({ session: "active01", ts: new Date(now - 60_000).toISOString(), thread: "writing the parser" }),
      JSON.stringify({ session: "closed99", ts: new Date(now - 3 * 3600_000).toISOString(), thread: "old work" })
    ].join("\n"));
    const note = renderBus(e, "self", { nowMs: now });
    expect(note).toContain("active01");
    expect(note).toContain("writing the parser");
    expect(note).not.toContain("closed99");
  });
});

describe("heartbeatEntry", () => {
  it("trims the thread, dedups and caps files, and carries the timestamp", () => {
    const e = heartbeatEntry("sess", "  redesign   the\n dashboard  ", ["a.ts", "a.ts", "b.ts", "", "c.ts"], "t1");
    expect(e.session).toBe("sess");
    expect(e.ts).toBe("t1");
    expect(e.thread).toBe("redesign the dashboard");
    expect(e.files).toEqual(["a.ts", "b.ts", "c.ts"]);
  });

  it("caps the thread at 120 chars and files at 8", () => {
    const e = heartbeatEntry("s", "x".repeat(200), Array.from({ length: 20 }, (_, i) => `f${i}.ts`), "t2");
    expect(e.thread).toHaveLength(120);
    expect(e.files).toHaveLength(8);
  });

  it("carries the tool when given, and round-trips through the bus", () => {
    const e = heartbeatEntry("s", "editing", ["a.ts"], "t3", "Edit");
    expect(e.tool).toBe("Edit");
    const parsed = parseBus([JSON.stringify(e)].join("\n"));
    expect(parsed[0]!.tool).toBe("Edit");
  });

  it("omits the tool entirely when not given", () => {
    const e = heartbeatEntry("s", "thinking", [], "t4");
    expect("tool" in e).toBe(false);
  });
});

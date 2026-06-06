import { describe, expect, it } from "vitest";
import { extractFailures } from "../src/dashboard/failures.js";
import type { Observation } from "../src/memory/observe.js";
import type { DashboardEvent } from "../src/dashboard/events.js";

function obs(partial: Partial<Observation>): Observation {
  return {
    id: 1, session: "sess", ts: "2026-06-06T12:00:00Z", kind: "edit",
    summary: "", detail: "", files: [], tags: [], vector: [], ...partial
  };
}

function ev(partial: Partial<DashboardEvent>): DashboardEvent {
  return { seq: 0, ts: "2026-06-06T12:00:00Z", session: "sess", agent: "main", kind: "post-tool", label: "", ...partial };
}

describe("extractFailures", () => {
  it("picks observations whose summary signals a failure", () => {
    const f = extractFailures([obs({ kind: "command", summary: "build failed with an error" })], []);
    expect(f).toHaveLength(1);
    expect(f[0]!.source).toBe("observation");
    expect(f[0]!.summary).toBe("build failed with an error");
  });

  it("picks observations whose detail reads like a failure", () => {
    const f = extractFailures([obs({ kind: "command", summary: "ran tsc", detail: "ENOENT: no such file" })], []);
    expect(f).toHaveLength(1);
  });

  it("ignores ordinary observations", () => {
    expect(extractFailures([obs({ kind: "edit", summary: "edited a file" })], [])).toEqual([]);
  });

  it("catches failure-shaped event labels", () => {
    const f = extractFailures([], [ev({ label: "Bash tsc: error TS2345", agent: "main" })]);
    expect(f).toHaveLength(1);
    expect(f[0]!.source).toBe("event");
  });

  it("ignores non-tool events and clean labels", () => {
    const f = extractFailures([], [ev({ kind: "pre-tool", label: "Read error.ts" }), ev({ label: "Edit ok.ts" })]);
    expect(f).toEqual([]);
  });

  it("sorts newest first", () => {
    const f = extractFailures([
      obs({ kind: "command", summary: "old error", ts: "2026-06-06T10:00:00Z" }),
      obs({ kind: "command", summary: "new error", ts: "2026-06-06T14:00:00Z" })
    ], []);
    expect(f[0]!.summary).toBe("new error");
  });
});

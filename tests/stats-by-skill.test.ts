import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  aggregateBySkill,
  renderSkillStats,
  readActiveSkill,
  writeActiveSkill,
  type Observation
} from "../src/memory/observe.js";

function mockObs(skill: string | undefined, files: string[]): Observation {
  return {
    id: 0,
    session: "s1",
    ts: new Date().toISOString(),
    kind: "edit",
    summary: "x",
    detail: "y",
    files,
    tags: [],
    vector: [],
    skill
  };
}

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "slipstream-stats-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("aggregateBySkill", () => {
  it("groups counts and averages opt% per skill", () => {
    const obs = [
      mockObs("scoped-read", ["a.ts"]),
      mockObs("scoped-read", ["b.ts", "c.ts"]),
      mockObs("digest", []),
      mockObs(undefined, ["d.ts"])
    ];
    const stats = aggregateBySkill(obs);
    const byName = new Map(stats.map((s) => [s.skill, s]));
    expect(byName.get("scoped-read")!.calls).toBe(2);
    expect(byName.get("scoped-read")!.avgOptPct).toBe(70);
    expect(byName.get("digest")!.calls).toBe(1);
    expect(byName.get("digest")!.avgOptPct).toBe(0);
    expect(byName.get("(none)")!.calls).toBe(1);
  });

  it("sorts skills by call count descending", () => {
    const obs = [
      mockObs("rare", []),
      mockObs("popular", ["a"]),
      mockObs("popular", ["b"]),
      mockObs("popular", ["c"])
    ];
    const stats = aggregateBySkill(obs);
    expect(stats[0]!.skill).toBe("popular");
  });

  it("returns an empty array when there is nothing to aggregate", () => {
    expect(aggregateBySkill([])).toEqual([]);
    expect(renderSkillStats([])).toContain("no observations");
  });

  it("round-trips the active skill marker on disk", async () => {
    expect(await readActiveSkill(root)).toBeUndefined();
    await writeActiveSkill(root, "scoped-read");
    expect(await readActiveSkill(root)).toBe("scoped-read");
    await writeActiveSkill(root, undefined);
    expect(await readActiveSkill(root)).toBeUndefined();
  });
});

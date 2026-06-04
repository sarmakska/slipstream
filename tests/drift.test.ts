import { describe, expect, it } from "vitest";
import { detectDrift, type Observation } from "../src/memory/observe.js";
import { renderObservations } from "../src/memory/search.js";

function obs(
  id: number,
  fields: Partial<Observation> = {}
): Observation {
  return {
    id,
    session: "s1",
    ts: new Date(2026, 0, id).toISOString(),
    kind: "note",
    summary: `summary ${id}`,
    detail: `detail ${id}`,
    files: [],
    tags: [],
    vector: [],
    ...fields
  };
}

describe("detectDrift", () => {
  it("flags an incoming observation whose claim contradicts an earlier one", () => {
    const history: Observation[] = [
      obs(1, { key: "stack.db", claim: "Postgres" })
    ];
    const incoming: Observation[] = [
      obs(2, { key: "stack.db", claim: "MySQL" })
    ];
    detectDrift(history, incoming);
    expect(incoming[0]!.drift).toBe(true);
  });

  it("does not flag a matching repeated claim", () => {
    const history: Observation[] = [
      obs(1, { key: "stack.db", claim: "Postgres" })
    ];
    const incoming: Observation[] = [
      obs(2, { key: "stack.db", claim: "Postgres" })
    ];
    detectDrift(history, incoming);
    expect(incoming[0]!.drift).toBeUndefined();
  });

  it("ignores observations without a key or claim", () => {
    const history: Observation[] = [obs(1, { claim: "x" })];
    const incoming: Observation[] = [obs(2, { claim: "y" })];
    detectDrift(history, incoming);
    expect(incoming[0]!.drift).toBeUndefined();
  });

  it("renders a DRIFT tag in sp_observations output", () => {
    const flagged = obs(3, {
      key: "stack.db",
      claim: "MySQL",
      drift: true
    });
    const rendered = renderObservations([flagged]);
    expect(rendered).toContain("[DRIFT]");
    expect(rendered).toContain("claim: MySQL");
  });
});

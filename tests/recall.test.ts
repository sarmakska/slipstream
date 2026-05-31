import { describe, expect, it } from "vitest";
import {
  rankBySignal,
  selectRelevant,
  renderRecall,
  RECALL_TOKEN_BUDGET,
  type TaskSignal
} from "../src/memory/recall.js";
import type { Memory } from "../src/memory/types.js";

function mem(partial: Partial<Memory> & Pick<Memory, "name" | "description">): Memory {
  return {
    type: "decision",
    tags: [],
    body: partial.description,
    sourcePath: `${partial.name}.md`,
    ...partial
  } as Memory;
}

const store: Memory[] = [
  mem({
    name: "stripe-webhook-signing",
    description: "Stripe webhook signatures verified with the signing secret",
    tags: ["payments", "stripe", "webhook"],
    type: "gotcha",
    body: "Use the raw body, not the parsed one, when verifying the Stripe signature."
  }),
  mem({
    name: "resend-from-domain",
    description: "Transactional email sends from notify@ on the verified domain",
    tags: ["email", "resend"],
    body: "Resend requires the sending domain to be verified first."
  }),
  mem({
    name: "supabase-rls-default-deny",
    description: "Every table has RLS on and denies by default",
    tags: ["supabase", "rls", "security"],
    body: "A table with RLS enabled and no policy denies all access."
  })
];

describe("rankBySignal", () => {
  it("ranks a branch-named memory first", () => {
    const signal: TaskSignal = { branch: "fix/stripe-webhook" };
    const hits = rankBySignal(store, signal);
    expect(hits[0]?.memory.name).toBe("stripe-webhook-signing");
    expect(hits[0]?.reasons.some((r) => r.startsWith("branch:"))).toBe(true);
  });

  it("uses changed files to surface the right memory", () => {
    const signal: TaskSignal = {
      changedFiles: ["src/lib/resend.ts", "src/emails/welcome.tsx"]
    };
    const hits = rankBySignal(store, signal);
    expect(hits[0]?.memory.name).toBe("resend-from-domain");
  });

  it("uses the last prompt to match tags", () => {
    const signal: TaskSignal = { lastPrompt: "add an RLS policy to the orders table" };
    const hits = rankBySignal(store, signal);
    expect(hits[0]?.memory.name).toBe("supabase-rls-default-deny");
  });

  it("returns nothing for an empty signal", () => {
    expect(rankBySignal(store, {})).toHaveLength(0);
  });
});

describe("selectRelevant", () => {
  it("returns only the relevant subset, not the whole store", () => {
    const signal: TaskSignal = { branch: "fix/stripe-webhook" };
    const hits = selectRelevant(store, signal);
    expect(hits.length).toBeLessThan(store.length);
    expect(hits[0]?.memory.name).toBe("stripe-webhook-signing");
  });

  it("stays within the token budget for a large store", () => {
    const big: Memory[] = [];
    for (let i = 0; i < 50; i += 1) {
      big.push(
        mem({
          name: `stripe-fact-${i}`,
          description: `stripe payments detail number ${i}`,
          tags: ["stripe", "payments"],
          body: "x".repeat(400)
        })
      );
    }
    const hits = selectRelevant(big, { branch: "feat/stripe" });
    const approxTokens = hits.reduce(
      (sum, h) => sum + Math.ceil((h.memory.body.length + h.memory.description.length) / 3.6),
      0
    );
    expect(approxTokens).toBeLessThanOrEqual(RECALL_TOKEN_BUDGET);
    expect(hits.length).toBeLessThan(big.length);
  });

  it("returns nothing with no signal, deferring to the index", () => {
    expect(selectRelevant(store, {})).toHaveLength(0);
  });
});

describe("renderRecall", () => {
  it("renders the matched subset with the match reasons", () => {
    const hits = selectRelevant(store, { branch: "fix/stripe-webhook" });
    const md = renderRecall(hits);
    expect(md).toContain("stripe-webhook-signing");
    expect(md).toContain("matched");
  });

  it("renders an empty string for no hits", () => {
    expect(renderRecall([])).toBe("");
  });
});

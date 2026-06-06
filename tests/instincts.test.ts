import { describe, expect, it } from "vitest";
import { deriveInstincts } from "../src/memory/instincts.js";
import type { Observation } from "../src/memory/observe.js";

function obs(partial: Partial<Observation>): Observation {
  return {
    id: 1, session: "s1", ts: "2026-06-06T12:00:00Z", kind: "edit",
    summary: "x", detail: "", files: [], tags: [], vector: [], ...partial
  };
}

describe("deriveInstincts", () => {
  it("promotes a file touched across multiple sessions to a hot-file instinct", () => {
    const ins = deriveInstincts([
      obs({ session: "s1", files: ["src/auth.ts"] }),
      obs({ session: "s2", files: ["src/auth.ts"] }),
      obs({ session: "s2", files: ["src/auth.ts"] })
    ]);
    const hot = ins.find((i) => i.subject === "src/auth.ts");
    expect(hot).toBeDefined();
    expect(hot!.kind).toBe("hot-file");
    expect(hot!.observations).toBe(3);
    expect(hot!.sessions).toBe(2);
    expect(hot!.note).toContain("hot spot");
  });

  it("ignores a file seen in only one session", () => {
    const ins = deriveInstincts([
      obs({ session: "s1", files: ["src/once.ts"] }),
      obs({ session: "s1", files: ["src/once.ts"] })
    ]);
    expect(ins.find((i) => i.subject === "src/once.ts")).toBeUndefined();
  });

  it("promotes a recurring tag to a topic instinct", () => {
    const ins = deriveInstincts([
      obs({ session: "s1", tags: ["auth"] }),
      obs({ session: "s2", tags: ["auth"] })
    ]);
    const topic = ins.find((i) => i.kind === "recurring-topic" && i.subject === "auth");
    expect(topic).toBeDefined();
    expect(topic!.sessions).toBe(2);
  });

  it("scores confidence higher for patterns spanning more sessions", () => {
    const few = deriveInstincts([
      obs({ session: "a", files: ["f.ts"] }), obs({ session: "b", files: ["f.ts"] })
    ])[0]!;
    const many = deriveInstincts([
      obs({ session: "a", files: ["f.ts"] }), obs({ session: "b", files: ["f.ts"] }),
      obs({ session: "c", files: ["f.ts"] }), obs({ session: "d", files: ["f.ts"] }),
      obs({ session: "e", files: ["f.ts"] })
    ])[0]!;
    expect(many.confidence).toBeGreaterThan(few.confidence);
    expect(many.confidence).toBe(1);
  });

  it("sorts the strongest instinct first", () => {
    const ins = deriveInstincts([
      obs({ session: "a", files: ["weak.ts"] }), obs({ session: "b", files: ["weak.ts"] }),
      obs({ session: "a", files: ["strong.ts"] }), obs({ session: "b", files: ["strong.ts"] }), obs({ session: "c", files: ["strong.ts"] })
    ]);
    expect(ins[0]!.subject).toBe("strong.ts");
  });
});

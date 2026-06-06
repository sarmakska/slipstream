import { describe, expect, it } from "vitest";
import { agentMood } from "../src/dashboard/presence.js";

describe("agentMood", () => {
  it("is waiting when the agent is not running", () => {
    expect(agentMood("done", "Edit a.ts").mood).toBe("waiting");
    expect(agentMood("idle", "anything").mood).toBe("waiting");
  });

  it("maps edit and write tools to typing", () => {
    expect(agentMood("running", "Edit src/a.ts").mood).toBe("typing");
    expect(agentMood("running", "Write src/b.ts").mood).toBe("typing");
  });

  it("maps read and search tools to reading", () => {
    expect(agentMood("running", "Read src/a.ts").mood).toBe("reading");
    expect(agentMood("running", "Grep foo").mood).toBe("reading");
  });

  it("maps bash to running a command", () => {
    const p = agentMood("running", "Bash pnpm test");
    expect(p.mood).toBe("running");
    expect(p.verb).toContain("command");
  });

  it("maps task to delegating", () => {
    expect(agentMood("running", "Task explore the code").mood).toBe("delegating");
  });

  it("falls back to thinking for an unknown tool", () => {
    expect(agentMood("running", "Wibble something").mood).toBe("thinking");
    expect(agentMood("running", "").mood).toBe("thinking");
  });
});

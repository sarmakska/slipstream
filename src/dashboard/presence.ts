/**
 * Presence: derive what an agent is doing right now from its latest activity, so
 * the dashboard can show it as a live character at work rather than a static row.
 * The mood drives an animation and a plain verb; the rendering lives in the UI.
 *
 * Pure and tested: same status and label always map to the same mood.
 */

export type AgentMood = "typing" | "reading" | "running" | "delegating" | "thinking" | "waiting";

export interface Presence {
  mood: AgentMood;
  /** A short present-tense verb for the speech bubble. */
  verb: string;
}

export function agentMood(status: string, lastLabel: string): Presence {
  if (status !== "running") return { mood: "waiting", verb: "waiting" };
  const tool = String(lastLabel).trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (tool === "edit" || tool === "write" || tool === "multiedit" || tool === "notebookedit") {
    return { mood: "typing", verb: "writing code" };
  }
  if (tool === "read" || tool === "grep" || tool === "glob" || tool === "search" || tool === "notebookread") {
    return { mood: "reading", verb: "reading" };
  }
  if (tool === "bash" || tool === "run") {
    return { mood: "running", verb: "running a command" };
  }
  if (tool === "task" || tool.startsWith("subagent")) {
    return { mood: "delegating", verb: "delegating" };
  }
  return { mood: "thinking", verb: "thinking" };
}

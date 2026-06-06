/**
 * Story: fold a session's event log into the said-to-did flow. Each lane begins
 * with something the person said and gathers the agent actions that followed it,
 * up to the next thing the person said. The result reads back as a narrative of
 * the session: you asked for X, the agent did A, B and C, and these files moved.
 *
 * Like everything in the dashboard this is a PURE function over the event log,
 * with no network and no LLM. The prose is a deterministic template, so the same
 * log always renders the same story and the tests can pin every branch.
 */

import type { DashboardEvent } from "./events.js";

/** One agent action inside a lane: a single thing the agent did. */
export interface StoryAction {
  seq: number;
  ts: string;
  /** The actor: "main" or a subagent id. */
  agent: string;
  kind: DashboardEvent["kind"];
  /** The first token of the label, the tool or verb. */
  tool: string;
  /** The full activity label, already redacted upstream. */
  label: string;
  /** The file this action touched, if the label named one. */
  file: string;
}

/** One lane: what the person said, and what the agent did about it. */
export interface StoryLane {
  index: number;
  /** When the person spoke, or when the lane opened. */
  ts: string;
  /** What the person said. Empty for the opening lane before the first prompt. */
  prompt: string;
  /** True for the synthetic lane that holds activity before the first prompt. */
  opening: boolean;
  actions: StoryAction[];
  /** Distinct files touched across the lane's actions, in first-seen order. */
  files: string[];
  /** Count of tool calls (post-tool actions) in the lane. */
  toolCount: number;
  /** Whether a subagent was dispatched within the lane. */
  delegated: boolean;
  /** One-line deterministic summary of what the agent did. */
  summary: string;
}

export interface Story {
  session: string;
  lanes: StoryLane[];
  /** Total prompts the person submitted in the session. */
  promptCount: number;
  /** Total tool calls across the session. */
  toolCount: number;
}

// -----------------------------------------------------------------------------
// Small local helpers (kept independent of insights.ts on purpose)
// -----------------------------------------------------------------------------

function firstToken(label: string): string {
  const m = String(label).trim().match(/^\S+/);
  return m ? m[0] : "";
}

/** Best-effort file target from an activity label: the rest after the tool. */
function fileFromLabel(label: string): string {
  const tool = firstToken(label);
  const target = String(label).slice(tool.length).trim();
  if (target && /[\\/.]/.test(target)) {
    // Take the first whitespace-delimited token that looks like a path.
    const tok = target.split(/\s+/).find((t) => /[\\/.]/.test(t));
    return tok ?? "";
  }
  return "";
}

function shortFile(p: string): string {
  if (!p) return "";
  const parts = p.replace(/^\/+/, "").split("/");
  return parts.length <= 2 ? parts.join("/") : parts.slice(-2).join("/");
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Map a tool name to a past-tense verb so the summary reads as prose. */
function verbFor(tool: string): string {
  const t = tool.toLowerCase();
  if (t === "edit" || t === "write" || t === "multiedit" || t === "notebookedit") return "edited";
  if (t === "read" || t === "notebookread") return "read";
  if (t === "bash" || t === "run") return "ran commands in";
  if (t === "grep" || t === "glob" || t === "search") return "searched";
  if (t === "task" || t.startsWith("subagent")) return "delegated work on";
  return "worked on";
}

function laneSummary(actions: StoryAction[], files: string[], delegated: boolean): string {
  const toolCalls = actions.filter((a) => a.kind === "post-tool").length;
  if (toolCalls === 0 && !delegated) return "No tool calls yet.";

  // Dominant verb: the most common tool's verb across the lane.
  const counts = new Map<string, number>();
  for (const a of actions) {
    if (a.kind !== "post-tool" || !a.tool) continue;
    counts.set(a.tool, (counts.get(a.tool) ?? 0) + 1);
  }
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const verb = dominant ? verbFor(dominant) : "worked on";

  const callClause = `${toolCalls} tool call${toolCalls === 1 ? "" : "s"}`;
  const fileClause = files.length
    ? `, ${verb} ${joinList(files.slice(0, 3).map(shortFile))}`
    : "";
  const delegateClause = delegated ? ". A subagent was dispatched" : "";
  return `${callClause}${fileClause}${delegateClause}.`;
}

// -----------------------------------------------------------------------------
// The generator
// -----------------------------------------------------------------------------

/** The event kinds that count as agent actions worth showing in a lane. */
const ACTION_KINDS = new Set<DashboardEvent["kind"]>([
  "post-tool",
  "subagent-start",
  "subagent-stop"
]);

export function storyFlow(events: DashboardEvent[]): Story {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const session = sorted[0]?.session ?? "";
  const lanes: StoryLane[] = [];

  let current: StoryLane | null = null;
  let promptCount = 0;
  let toolCount = 0;

  const open = (ts: string, prompt: string, opening: boolean): StoryLane => {
    const lane: StoryLane = {
      index: lanes.length,
      ts,
      prompt,
      opening,
      actions: [],
      files: [],
      toolCount: 0,
      delegated: false,
      summary: ""
    };
    lanes.push(lane);
    return lane;
  };

  for (const e of sorted) {
    if (e.kind === "user-prompt") {
      promptCount += 1;
      current = open(e.ts, e.label || "(empty prompt)", false);
      continue;
    }
    if (!ACTION_KINDS.has(e.kind)) continue; // session-start, pre-tool, stop: skip
    if (!current) current = open(e.ts, "", true); // activity before the first prompt

    const tool = firstToken(e.label);
    const file = fileFromLabel(e.label);
    current.actions.push({
      seq: e.seq,
      ts: e.ts,
      agent: e.agent,
      kind: e.kind,
      tool,
      label: e.label,
      file
    });
    if (e.kind === "post-tool") {
      current.toolCount += 1;
      toolCount += 1;
    }
    if (e.kind === "subagent-start") current.delegated = true;
    if (file && !current.files.includes(file)) current.files.push(file);
  }

  for (const lane of lanes) {
    lane.summary = laneSummary(lane.actions, lane.files, lane.delegated);
  }

  return { session, lanes, promptCount, toolCount };
}

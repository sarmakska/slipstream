/**
 * Reduce a stream of events into dashboard state. This is the heart of replay:
 * the same fold runs over a live tail and over a recorded log, so a finished
 * session reconstructs exactly the same picture it showed while it ran.
 *
 * The reducer is pure and total. Unknown event kinds are ignored rather than
 * throwing, because a newer log replayed by an older build must still render.
 */

import { BYTES_PER_TOKEN, DEFAULT_WINDOW_TOKENS } from "../context/budget.js";
import type { DashboardEvent } from "./events.js";

export type AgentStatus = "running" | "waiting" | "done" | "failed";

export interface AgentState {
  id: string;
  status: AgentStatus;
  /** The task or last activity label shown next to the agent. */
  task: string;
  /** Approximate tokens this agent has pulled into context. */
  approxTokens: number;
  /** Tool calls observed for this agent. */
  toolCalls: number;
  /** The agent's recent activity stream, most recent last. */
  activity: ActivityEntry[];
}

export interface ActivityEntry {
  seq: number;
  ts: string;
  kind: DashboardEvent["kind"];
  label: string;
}

export interface DashboardState {
  session: string | null;
  /** Token window for the budget bar; the default model window. */
  windowTokens: number;
  agents: AgentState[];
  /** The current plan lines, last one wins if several were posted. */
  plan: string[];
  /** Latest seq folded in, so the client knows where it is. */
  lastSeq: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export function emptyState(): DashboardState {
  return {
    session: null,
    windowTokens: DEFAULT_WINDOW_TOKENS,
    agents: [],
    plan: [],
    lastSeq: -1,
    startedAt: null,
    finishedAt: null
  };
}

const MAX_ACTIVITY = 200;

function ensureAgent(state: DashboardState, id: string): AgentState {
  let agent = state.agents.find((a) => a.id === id);
  if (!agent) {
    agent = {
      id,
      status: "running",
      task: id === "main" ? "main session" : "subagent",
      approxTokens: 0,
      toolCalls: 0,
      activity: []
    };
    state.agents.push(agent);
  }
  return agent;
}

function bytesOf(data: DashboardEvent["data"]): number {
  const raw = data?.["bytes"];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

/** Fold one event into a state object, mutating and returning it. */
export function applyEvent(
  state: DashboardState,
  event: DashboardEvent
): DashboardState {
  if (event.seq <= state.lastSeq) return state; // already folded, idempotent
  state.lastSeq = event.seq;
  state.session = event.session;
  const agent = ensureAgent(state, event.agent);

  agent.activity.push({
    seq: event.seq,
    ts: event.ts,
    kind: event.kind,
    label: event.label
  });
  if (agent.activity.length > MAX_ACTIVITY) {
    agent.activity.splice(0, agent.activity.length - MAX_ACTIVITY);
  }

  switch (event.kind) {
    case "session-start":
      state.startedAt = event.ts;
      agent.status = "running";
      break;
    case "user-prompt":
      agent.status = "running";
      agent.task = event.label;
      break;
    case "pre-tool":
      agent.status = "running";
      agent.toolCalls += 1;
      agent.task = event.label;
      break;
    case "post-tool":
      agent.approxTokens += Math.round(bytesOf(event.data) / BYTES_PER_TOKEN);
      agent.status = "running";
      break;
    case "subagent-start":
      agent.status = "running";
      agent.task = event.label;
      break;
    case "subagent-stop":
      agent.status = event.data?.["failed"] ? "failed" : "done";
      break;
    case "stop":
      // The main session is idle, not finished: more prompts may follow.
      if (agent.id === "main") agent.status = "waiting";
      else agent.status = "done";
      state.finishedAt = event.ts;
      break;
    default:
      break;
  }

  // The plan is carried on any event that ships one, so it can update live.
  const plan = event.data?.["plan"];
  if (Array.isArray(plan)) {
    state.plan = plan.filter((p): p is string => typeof p === "string");
  }

  return state;
}

/** Reconstruct full state from a recorded log. This is replay. */
export function reduceEvents(events: DashboardEvent[]): DashboardState {
  const state = emptyState();
  for (const event of events) applyEvent(state, event);
  return state;
}

/** Total approximate tokens across every agent, for the headline budget bar. */
export function totalApproxTokens(state: DashboardState): number {
  return state.agents.reduce((sum, a) => sum + a.approxTokens, 0);
}

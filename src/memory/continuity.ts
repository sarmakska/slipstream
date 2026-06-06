/**
 * Continuity: reconstruct "where we left off" so no session starts cold. Built
 * from the captured conversation and the session's observations, it gives both
 * the human and Claude the same short brief: the last thing asked, the recent
 * thread, the files in flight and a suggested next step.
 *
 * Pure. The SessionStart hook injects this for the agent; the dashboard shows
 * the same brief on the Overview, so the two never disagree about state.
 */

import type { Conversation } from "./conversation.js";
import type { Observation } from "./observe.js";

export interface ResumeBrief {
  /** True when there is enough history to resume from. */
  hasContext: boolean;
  /** ISO timestamp of the most recent activity, or null. */
  lastActive: string | null;
  /** The most recent thing the human asked, the live thread. */
  openThread: string;
  /** The last few asks, newest first, for context. */
  recentAsks: string[];
  /** Files touched most recently, the work in flight. */
  filesInFlight: string[];
  /** A plain suggested next step. */
  suggestedNext: string;
}

function shortFile(p: string): string {
  if (!p) return "";
  const parts = p.replace(/^\/+/, "").split("/");
  return parts.length <= 2 ? parts.join("/") : parts.slice(-2).join("/");
}

function clip(s: string, n: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, n);
}

export function resumeBrief(conversation: Conversation | null, observations: Observation[]): ResumeBrief {
  const exchanges = conversation?.exchanges ?? [];
  const asks = exchanges.map((e) => e.ask).filter(Boolean);

  // Files in flight: most recent observations first, deduped.
  const recentObs = [...observations].sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const filesInFlight: string[] = [];
  for (const o of recentObs) {
    for (const f of o.files || []) {
      const short = shortFile(f);
      if (short && !filesInFlight.includes(short)) filesInFlight.push(short);
    }
    if (filesInFlight.length >= 5) break;
  }

  const lastTs = recentObs[0]?.ts ?? (exchanges.length ? exchanges[exchanges.length - 1]!.ts : null);
  const openThread = asks.length ? clip(asks[asks.length - 1]!, 240) : "";
  const hasContext = asks.length > 0 || observations.length > 0;

  let suggestedNext: string;
  if (openThread) {
    suggestedNext = `Continue the open thread: ${clip(openThread, 120)}`;
  } else if (filesInFlight.length) {
    suggestedNext = `Pick up the files in flight: ${filesInFlight.slice(0, 3).join(", ")}.`;
  } else {
    suggestedNext = "No prior context. Start by stating the task and recalling memory.";
  }

  return {
    hasContext,
    lastActive: lastTs,
    openThread,
    recentAsks: asks.slice(-3).reverse().map((a) => clip(a, 160)),
    filesInFlight,
    suggestedNext
  };
}

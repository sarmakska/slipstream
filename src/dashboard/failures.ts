/**
 * Failures: surface where the agent struggled. Operators want to see not just
 * what Claude did but where it hit an error, a denial or a failed command, so
 * they can step in. This pulls those moments out of the observation store and
 * the event log into one ranked list.
 *
 * Pure over observations and events. The dashboard renders the result; nothing
 * here touches disk or the network.
 */

import type { Observation } from "../memory/observe.js";
import type { DashboardEvent } from "./events.js";

export interface Failure {
  ts: string;
  /** "observation" when distilled, "event" when caught live in the log. */
  source: "observation" | "event";
  /** The actor: main or a subagent id. */
  agent: string;
  /** A short line describing what went wrong. */
  summary: string;
}

/** Words in a label or summary that mark a failure. Deliberately blunt. */
const FAILURE_PATTERN = /\b(error|errors|failed|failure|exception|denied|rejected|cannot|not found|timed out|timeout|traceback|fatal|enoent|eacces)\b/i;

export function extractFailures(observations: Observation[], events: DashboardEvent[]): Failure[] {
  const failures: Failure[] = [];

  for (const o of observations) {
    const isError = FAILURE_PATTERN.test(o.summary || "") || FAILURE_PATTERN.test(o.detail || "");
    if (!isError) continue;
    failures.push({
      ts: o.ts,
      source: "observation",
      agent: o.session,
      summary: (o.summary || "error").replace(/\s+/g, " ").trim().slice(0, 200)
    });
  }

  for (const e of events) {
    if (e.kind !== "post-tool" && e.kind !== "stop") continue;
    if (!FAILURE_PATTERN.test(e.label || "")) continue;
    failures.push({
      ts: e.ts,
      source: "event",
      agent: e.agent,
      summary: (e.label || "error").replace(/\s+/g, " ").trim().slice(0, 200)
    });
  }

  // Newest first, so the most recent struggle is at the top.
  return failures.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
}

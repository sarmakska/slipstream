/**
 * Instincts: notice what recurs. slipstream watches the observation store and
 * promotes patterns that show up across sessions into ranked, confidence-scored
 * insights, so the project gets sharper with every run rather than forgetting.
 * This is the self-learning loop, done locally and deterministically: no LLM,
 * just counting what keeps happening.
 *
 * Pure over the observations. The dashboard renders the result.
 */

import type { Observation } from "./observe.js";

export type InstinctKind = "hot-file" | "recurring-topic";

export interface Instinct {
  kind: InstinctKind;
  /** The file or tag the instinct is about. */
  subject: string;
  /** How many observations touched it. */
  observations: number;
  /** How many distinct sessions it spanned. */
  sessions: number;
  /** 0 to 1, rising with how many sessions it recurs across. */
  confidence: number;
  /** A plain-English line for the dashboard. */
  note: string;
}

/** Confidence rises with cross-session recurrence, saturating at five sessions. */
function confidenceFor(sessions: number): number {
  return Math.min(1, Math.round((sessions / 5) * 100) / 100);
}

export function deriveInstincts(observations: Observation[], minSessions = 2): Instinct[] {
  const fileObs = new Map<string, number>();
  const fileSessions = new Map<string, Set<string>>();
  const tagObs = new Map<string, number>();
  const tagSessions = new Map<string, Set<string>>();

  for (const o of observations) {
    for (const f of o.files || []) {
      if (!f) continue;
      fileObs.set(f, (fileObs.get(f) ?? 0) + 1);
      (fileSessions.get(f) ?? fileSessions.set(f, new Set()).get(f)!).add(o.session);
    }
    for (const t of o.tags || []) {
      if (!t) continue;
      tagObs.set(t, (tagObs.get(t) ?? 0) + 1);
      (tagSessions.get(t) ?? tagSessions.set(t, new Set()).get(t)!).add(o.session);
    }
  }

  const instincts: Instinct[] = [];

  for (const [file, count] of fileObs) {
    const sessions = fileSessions.get(file)?.size ?? 0;
    if (sessions < minSessions) continue;
    instincts.push({
      kind: "hot-file",
      subject: file,
      observations: count,
      sessions,
      confidence: confidenceFor(sessions),
      note: `${file} is a hot spot: touched ${count} times across ${sessions} sessions.`
    });
  }

  for (const [tag, count] of tagObs) {
    const sessions = tagSessions.get(tag)?.size ?? 0;
    if (sessions < minSessions) continue;
    instincts.push({
      kind: "recurring-topic",
      subject: tag,
      observations: count,
      sessions,
      confidence: confidenceFor(sessions),
      note: `"${tag}" keeps coming up: ${count} times across ${sessions} sessions.`
    });
  }

  // Strongest first: more sessions, then more observations.
  return instincts.sort((a, b) => b.sessions - a.sessions || b.observations - a.observations);
}

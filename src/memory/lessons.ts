/**
 * Lesson distillation — slipstream's take on "continuous learning". The
 * observation store already records every turn of work; over time the same areas
 * of a codebase get touched again and again. A lesson is the distilled version of
 * that: a recurring topic, how often it came up, across how many sessions, which
 * files it centred on, and what kind of work it mostly was. It turns a long, flat
 * history into a short list of "here is what this project keeps making you do".
 *
 * The point is to surface durable patterns without the agent having to re-read the
 * whole history. A lesson is a candidate worth promoting to a hand-authored memory
 * with sp_remember, or just a quick answer to "what do I keep working on here".
 *
 * Distillation is a pure function over loaded observations (no IO, no clock) so a
 * test pins it exactly; a thin wrapper loads the store and calls it.
 */

import { loadObservations, type Observation, type ObservationKind } from "./observe.js";

/** A recurring pattern distilled from the observation store. */
export interface Lesson {
  /** The recurring topic — a file/concept stem the work clustered around. */
  topic: string;
  /** Number of observations in the cluster. */
  count: number;
  /** Distinct sessions the topic appeared in. */
  sessions: number;
  /** The files most associated with the topic, most frequent first. */
  files: string[];
  /** The dominant kind of work on this topic. */
  dominantKind: ObservationKind;
  /** A one-line human summary. */
  summary: string;
  /** The observation ids behind the lesson, for citation and drill-down. */
  observationIds: number[];
}

/** File/concept stems from a path: lib/actions/approvals.ts -> [actions, approvals]. */
function stemsOf(paths: string[]): string[] {
  const out = new Set<string>();
  for (const p of paths) {
    for (const seg of p.split(/[\\/]/)) {
      const stem = seg.replace(/\.[a-z0-9]+$/i, "");
      for (const part of stem.split(/[^a-z0-9]+/i)) {
        const t = part.toLowerCase();
        // Skip noise segments that name structure, not concepts.
        if (t.length > 2 && !["src", "lib", "app", "index", "test", "tests", "spec"].includes(t)) {
          out.add(t);
        }
      }
    }
  }
  return [...out];
}

export interface DistillOptions {
  /** Minimum observations for a topic to count as a lesson. */
  minCount?: number;
  /** Maximum lessons returned. */
  limit?: number;
}

/**
 * Distil lessons from observations by clustering on the file/concept stems the
 * work touched. A topic that recurs (>= minCount observations) becomes a lesson,
 * ranked by how broadly it spans the project's history (count weighted by the
 * number of distinct sessions, so a topic revisited across many sessions ranks
 * above one hit hard in a single session).
 */
export function distillLessons(
  observations: Observation[],
  opts: DistillOptions = {}
): Lesson[] {
  const minCount = opts.minCount ?? 3;
  const limit = opts.limit && opts.limit > 0 ? opts.limit : 10;

  const buckets = new Map<string, Observation[]>();
  for (const o of observations) {
    for (const stem of stemsOf(o.files)) {
      const bucket = buckets.get(stem) ?? [];
      bucket.push(o);
      buckets.set(stem, bucket);
    }
  }

  const lessons: Lesson[] = [];
  for (const [topic, obs] of buckets) {
    if (obs.length < minCount) continue;
    const sessions = new Set(obs.map((o) => o.session)).size;

    // Most-touched files in this cluster.
    const fileFreq = new Map<string, number>();
    const kindFreq = new Map<ObservationKind, number>();
    for (const o of obs) {
      for (const f of o.files) fileFreq.set(f, (fileFreq.get(f) ?? 0) + 1);
      kindFreq.set(o.kind, (kindFreq.get(o.kind) ?? 0) + 1);
    }
    const files = [...fileFreq.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 5);
    const dominantKind = [...kindFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "note";

    const summary =
      `Recurring work on "${topic}": ${obs.length} observation${obs.length > 1 ? "s" : ""} ` +
      `across ${sessions} session${sessions > 1 ? "s" : ""}, mostly ${dominantKind}` +
      (files.length ? `; files: ${files.slice(0, 3).join(", ")}` : "") + ".";

    lessons.push({
      topic,
      count: obs.length,
      sessions,
      files,
      dominantKind,
      summary,
      observationIds: obs.map((o) => o.id)
    });
  }

  return lessons
    .sort((a, b) => b.count * b.sessions - a.count * a.sessions || b.count - a.count)
    .slice(0, limit);
}

/** Load the observation store and distil lessons from it. */
export async function distillProjectLessons(
  projectRoot: string,
  opts: DistillOptions = {}
): Promise<Lesson[]> {
  return distillLessons(await loadObservations(projectRoot), opts);
}

/** Render lessons as text for an MCP/CLI result. */
export function renderLessons(lessons: Lesson[]): string {
  if (lessons.length === 0) {
    return "no recurring lessons yet — keep working and the observation store will reveal patterns";
  }
  return lessons
    .map((l) => `- ${l.summary} [obs ${l.observationIds.slice(0, 6).join(", ")}${l.observationIds.length > 6 ? ", …" : ""}]`)
    .join("\n");
}

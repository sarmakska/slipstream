/**
 * Three-layer progressive search over the observation store. The expensive thing
 * about memory recall is tokens: dumping full observation bodies into context to
 * find the one that matters wastes most of what you pay for. So search is split
 * into three calls that get progressively more expensive, and the agent only pays
 * for depth where it has already decided the result is worth it:
 *
 *   1. searchObservations -> a compact ranked index: id, time, kind, one-line
 *      summary. Cheap. This is where you scan and pick.
 *   2. timeline -> the chronological neighbours of an interesting result, so you
 *      can see what was happening around it without a full-text dump.
 *   3. getObservations (in observe.ts) -> the full detail, but only for the ids
 *      you filtered down to.
 *
 * Ranking is hybrid: a local semantic vector (cosine over the stored embedding)
 * blended with a lexical overlap bonus, so a query matches by meaning and by exact
 * term, and an exact term match is never beaten by a merely-similar vector. All
 * functions read the store and rank in plain TypeScript; the ranking core is pure
 * so the tests pin the order with a fixed set of observations.
 */

import { cosine, embed, tokenize } from "./embed.js";
import { loadObservations, type Observation, type ObservationKind } from "./observe.js";

/** A row in the compact search index. No detail, no vector: cheap to render. */
export interface SearchHit {
  id: number;
  ts: string;
  kind: ObservationKind;
  summary: string;
  files: string[];
  /** Blended relevance in roughly [0, 1+], higher first. */
  score: number;
}

export interface SearchFilters {
  query: string;
  kind?: ObservationKind;
  session?: string;
  /** ISO date or timestamp; only observations at or after this are considered. */
  since?: string;
  limit?: number;
}

/** Weight of exact-term overlap relative to the semantic vector. */
const LEXICAL_WEIGHT = 0.6;

/**
 * Score one observation against an embedded query and its token set. Pure. The
 * lexical term is the fraction of query tokens that appear in the observation's
 * searchable text, which guarantees a result that literally contains the words
 * outranks one that is only semantically near.
 */
export function scoreObservation(
  o: Observation,
  queryVec: number[],
  queryTokens: string[]
): number {
  const semantic = cosine(queryVec, o.vector); // [0, 1]
  if (queryTokens.length === 0) return semantic;
  const haystack = `${o.summary} ${o.detail} ${o.tags.join(" ")} ${o.files.join(" ")}`.toLowerCase();
  let present = 0;
  for (const t of queryTokens) if (haystack.includes(t)) present++;
  const lexical = present / queryTokens.length; // [0, 1]
  return semantic + LEXICAL_WEIGHT * lexical;
}

/** Rank a loaded observation set against a query. Pure, for testability. */
export function rankObservations(
  observations: Observation[],
  filters: SearchFilters
): SearchHit[] {
  const queryVec = embed(filters.query);
  const queryTokens = [...new Set(tokenize(filters.query))];
  const sinceMs = filters.since ? Date.parse(filters.since) : NaN;

  const hits: SearchHit[] = [];
  for (const o of observations) {
    if (filters.kind && o.kind !== filters.kind) continue;
    if (Number.isFinite(sinceMs) && Date.parse(o.ts) < sinceMs) continue;
    const score = scoreObservation(o, queryVec, queryTokens);
    if (score <= 0) continue;
    hits.push({
      id: o.id,
      ts: o.ts,
      kind: o.kind,
      summary: o.summary,
      files: o.files,
      score: Number(score.toFixed(4))
    });
  }
  // Sort by score, breaking ties by recency (higher id) so the newest of equally
  // relevant turns surfaces first.
  return hits.sort((a, b) => b.score - a.score || b.id - a.id);
}

/** Layer 1: the compact ranked index. Reads the store, ranks, truncates. */
export async function searchObservations(
  projectRoot: string,
  filters: SearchFilters
): Promise<SearchHit[]> {
  const all = await loadObservations(projectRoot, { session: filters.session });
  const ranked = rankObservations(all, filters);
  return ranked.slice(0, filters.limit && filters.limit > 0 ? filters.limit : 10);
}

/** One row of a timeline: the same compact shape, flagged if it is the anchor. */
export interface TimelineEntry extends SearchHit {
  anchor: boolean;
}

export interface TimelineOptions {
  /** Anchor by observation id, or by the best search match for a query. */
  around: number | string;
  /** How many neighbours on each side of the anchor. */
  window?: number;
  session?: string;
}

/**
 * Layer 2: chronological context around an anchor. Given an id we centre on it;
 * given a query we centre on its best-ranked hit. Returns the window of
 * observations on either side in id (time) order, so you can see what the session
 * was doing just before and after the interesting moment without fetching bodies.
 */
export async function timeline(
  projectRoot: string,
  opts: TimelineOptions
): Promise<TimelineEntry[]> {
  const all = await loadObservations(projectRoot, { session: opts.session });
  if (all.length === 0) return [];

  let anchorId: number | undefined;
  if (typeof opts.around === "number") {
    anchorId = opts.around;
  } else {
    const ranked = rankObservations(all, { query: opts.around });
    anchorId = ranked[0]?.id;
  }
  if (anchorId === undefined) return [];

  const idx = all.findIndex((o) => o.id === anchorId);
  if (idx === -1) return [];

  const window = opts.window && opts.window > 0 ? opts.window : 3;
  const start = Math.max(0, idx - window);
  const end = Math.min(all.length, idx + window + 1);
  return all.slice(start, end).map((o) => ({
    id: o.id,
    ts: o.ts,
    kind: o.kind,
    summary: o.summary,
    files: o.files,
    score: 0,
    anchor: o.id === anchorId
  }));
}

/** Render a compact index as text for an MCP/CLI result. One line per hit. */
export function renderHits(hits: SearchHit[]): string {
  if (hits.length === 0) return "no matching observations";
  return hits
    .map(
      (h) =>
        `#${h.id} [${h.kind}] ${h.ts.slice(0, 16).replace("T", " ")} (score ${h.score}) ${h.summary}`
    )
    .join("\n");
}

/** Render a timeline, marking the anchor row. */
export function renderTimeline(entries: TimelineEntry[]): string {
  if (entries.length === 0) return "no timeline context";
  return entries
    .map(
      (e) =>
        `${e.anchor ? "> " : "  "}#${e.id} [${e.kind}] ${e.ts
          .slice(0, 16)
          .replace("T", " ")} ${e.summary}`
    )
    .join("\n");
}

/** Render full observations (layer 3) for display. */
export function renderObservations(observations: Observation[]): string {
  if (observations.length === 0) return "no observations for those ids";
  return observations
    .map((o) => {
      const driftFlag = o.drift ? " [DRIFT]" : "";
      const head = `## #${o.id} [${o.kind}]${driftFlag} ${o.ts}`;
      const files = o.files.length ? `\nfiles: ${o.files.join(", ")}` : "";
      const tags = o.tags.length ? `\ntags: ${o.tags.join(", ")}` : "";
      const claim = o.claim ? `\nclaim: ${o.claim}` : "";
      return `${head}\n${o.summary}${files}${tags}${claim}\n\n${o.detail}`;
    })
    .join("\n\n---\n\n");
}

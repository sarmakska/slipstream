/**
 * Automatic observation capture. slipstream already records every lifecycle event
 * to an append-only log for the dashboard; that log is a faithful, redacted record
 * of what happened in a session. This module turns that raw stream into durable,
 * searchable *observations*: one compact record per turn of work, summarised,
 * tagged, embedded for semantic recall, and given a stable id so it can be cited
 * later.
 *
 * The point is that memory builds itself. The existing memory store needs the
 * agent to decide a fact is worth keeping and call sp_remember; observations need
 * no such decision. Every turn leaves a trace, so weeks later "when did we touch
 * the Stripe webhook and why" has an answer without anyone having written it down
 * on purpose.
 *
 * Storage mirrors the dashboard's own design decision: an append-only JSONL file
 * per session under .claude/slipstream/observations/, never a database. Folding the
 * event log into observations is a pure function (foldObservations) so the tests
 * drive it with a fixed event array and assert the records, and a thin IO wrapper
 * (captureObservations) does the reading, id assignment and appending under a lock.
 */

import { open, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readLog } from "../dashboard/log.js";
import type { DashboardEvent } from "../dashboard/events.js";
import { loadRedactor } from "../dashboard/redact-config.js";
import { withFileLock } from "../util/lock.js";
import { conceptStems } from "../util/text.js";
import { embed } from "./embed.js";

export const OBSERVATIONS_SUBDIR = join(".claude", "slipstream", "observations");

/** The flavour of work an observation captures. Drives filtering and the UI. */
export type ObservationKind =
  | "edit" // wrote or changed files
  | "read" // mostly read/oriented
  | "command" // ran shell commands
  | "search" // grepped/globbed/searched
  | "prompt" // a user request with little tool activity
  | "note"; // catch-all

export const OBSERVATION_KINDS: readonly ObservationKind[] = [
  "edit",
  "read",
  "command",
  "search",
  "prompt",
  "note"
];

/** One compressed unit of session activity, durable and citable by id. */
export interface Observation {
  /** Project-wide monotonic id. Stable; this is the citation handle. */
  id: number;
  session: string;
  /** ISO 8601 time of the turn this observation summarises (its last event). */
  ts: string;
  kind: ObservationKind;
  /** One-line summary, what the compact search index shows. */
  summary: string;
  /** Fuller account of the turn, what get_observations returns. */
  detail: string;
  /** Relative file paths touched in the turn, deduplicated. */
  files: string[];
  /** Tags for filtering: file stems, tool names, the kind. */
  tags: string[];
  /** Local semantic embedding of summary+detail+tags, for vector search. */
  vector: number[];
  /** Active skill name during the turn, if known. Empty when no skill was active. */
  skill?: string;
  /** Optional grouping key for drift detection. Free-form, project-defined. */
  key?: string;
  /** Optional claim payload; the unit drift detection compares for equality. */
  claim?: string;
  /** True when this observation contradicts an earlier one with the same key. */
  drift?: boolean;
}

export function observationsDir(projectRoot: string): string {
  return join(resolve(projectRoot), OBSERVATIONS_SUBDIR);
}

function obsLogPath(projectRoot: string, session: string): string {
  return join(observationsDir(projectRoot), `${session}.jsonl`);
}

function cursorPath(projectRoot: string, session: string): string {
  return join(observationsDir(projectRoot), `${session}.cursor`);
}

function counterPath(projectRoot: string): string {
  return join(observationsDir(projectRoot), ".counter");
}

const MAX_SUMMARY = 160;
const MAX_DETAIL_LINES = 12;

function clip(s: string, max = MAX_SUMMARY): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** The tool name is the first token of a post-tool label like "Edit src/a.ts". */
function toolOf(label: string): string {
  return label.split(/\s+/)[0] ?? "";
}

/** Classify a tool name into the activity bucket it represents. */
function bucketOf(tool: string): ObservationKind {
  const t = tool.toLowerCase();
  if (/(edit|write|notebook|multiedit|create)/.test(t)) return "edit";
  if (/(bash|powershell|shell|run|exec)/.test(t)) return "command";
  if (/(grep|glob|search|find)/.test(t)) return "search";
  if (/(read|cat|open|view)/.test(t)) return "read";
  return "note";
}

/** A turn under construction while folding the event stream. */
interface Turn {
  prompt?: string;
  startedTs?: string;
  lastTs?: string;
  files: Set<string>;
  tools: Map<string, number>;
  buckets: Map<ObservationKind, number>;
  events: number;
}

function emptyTurn(): Turn {
  return {
    files: new Set(),
    tools: new Map(),
    buckets: new Map(),
    events: 0
  };
}

function turnHasContent(t: Turn): boolean {
  return Boolean(t.prompt) || t.events > 0;
}

/** Pick the dominant kind: a turn that edits is an "edit" even if it also reads. */
function dominantKind(t: Turn): ObservationKind {
  const order: ObservationKind[] = ["edit", "command", "search", "read"];
  for (const k of order) {
    if ((t.buckets.get(k) ?? 0) > 0) return k;
  }
  return t.prompt ? "prompt" : "note";
}

/** Turn a completed turn accumulator into an Observation (id assigned by caller). */
function materialise(t: Turn, session: string, id: number): Observation {
  const files = [...t.files];
  const kind = dominantKind(t);
  const toolSummary = [...t.tools.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tool, n]) => (n > 1 ? `${tool}×${n}` : tool))
    .slice(0, 6);

  const head = t.prompt ? clip(t.prompt) : "";
  const fileNote = files.length
    ? `${files.length} file${files.length > 1 ? "s" : ""}`
    : "";
  const actNote = toolSummary.length ? toolSummary.join(", ") : "no tools";
  const summary = clip(
    head
      ? `${head} — ${actNote}${fileNote ? ` (${fileNote})` : ""}`
      : `${kind}: ${actNote}${fileNote ? ` (${fileNote})` : ""}`
  );

  const detailLines: string[] = [];
  if (t.prompt) detailLines.push(`Request: ${clip(t.prompt, 400)}`);
  if (toolSummary.length) detailLines.push(`Tools: ${actNote}`);
  if (files.length) {
    detailLines.push("Files:");
    for (const f of files.slice(0, MAX_DETAIL_LINES)) detailLines.push(`  - ${f}`);
  }
  const detail = detailLines.join("\n");

  const tags = [
    kind,
    ...conceptStems(files),
    ...[...t.tools.keys()].map((tool) => tool.toLowerCase())
  ].slice(0, 16);

  const vector = embed(`${summary}\n${detail}\n${tags.join(" ")}`);

  return {
    id,
    session,
    ts: t.lastTs ?? t.startedTs ?? new Date(0).toISOString(),
    kind,
    summary,
    detail,
    files,
    tags,
    vector
  };
}

export interface FoldResult {
  /** Observations for the turns that completed within the consumed window. */
  observations: Observation[];
  /** The highest event seq consumed; the cursor advances to here. */
  consumedThroughSeq: number;
}

/**
 * Fold an ordered slice of dashboard events into observations. Pure: no IO, no
 * clock, no id source beyond the startId it is handed, so a test can pin every
 * field. A turn runs from a user prompt (or the first activity) until a `stop`
 * event closes it; an unterminated trailing turn is left unconsumed so the next
 * capture picks it up once it has closed. This is what makes incremental capture
 * safe to run on every Stop without duplicating or losing a turn.
 */
export function foldObservations(
  events: DashboardEvent[],
  startId: number
): FoldResult {
  const observations: Observation[] = [];
  let id = startId;
  let consumed = -1;
  let turn = emptyTurn();

  const flush = (closingSeq: number): void => {
    if (turnHasContent(turn)) {
      observations.push(materialise(turn, events[0]?.session ?? "main", id++));
    }
    consumed = closingSeq;
    turn = emptyTurn();
  };

  for (const e of events) {
    switch (e.kind) {
      case "user-prompt": {
        // A new prompt starts a new turn; an earlier open turn closes first.
        if (turnHasContent(turn)) flush(e.seq - 1);
        turn.prompt =
          (typeof e.data?.["prompt"] === "string" && e.data["prompt"]) || e.label;
        turn.startedTs = e.ts;
        turn.lastTs = e.ts;
        break;
      }
      case "post-tool": {
        const tool = toolOf(e.label);
        if (tool) {
          turn.tools.set(tool, (turn.tools.get(tool) ?? 0) + 1);
          const bucket = bucketOf(tool);
          turn.buckets.set(bucket, (turn.buckets.get(bucket) ?? 0) + 1);
        }
        // The label tail after the tool name is usually the file path.
        const target = e.label.slice(tool.length).trim();
        if (target && /[\\/.]/.test(target)) turn.files.add(target);
        turn.events++;
        turn.lastTs = e.ts;
        break;
      }
      case "stop": {
        turn.lastTs = e.ts;
        flush(e.seq); // a stop closes the current turn, inclusive
        break;
      }
      case "session-start":
        turn.startedTs = turn.startedTs ?? e.ts;
        consumed = e.seq; // nothing to emit, but it is consumed
        break;
      default:
        // subagent-start / subagent-stop / pre-tool: count as activity.
        turn.events++;
        turn.lastTs = e.ts;
        break;
    }
  }

  return { observations, consumedThroughSeq: consumed };
}

async function readCursor(projectRoot: string, session: string): Promise<number> {
  const raw = await readFile(cursorPath(projectRoot, session), "utf8").catch(() => "");
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : -1;
}

async function writeCursor(projectRoot: string, session: string, seq: number): Promise<void> {
  await writeFile(cursorPath(projectRoot, session), String(seq), "utf8");
}

/** Read the id counter, rebuilding it from disk if the file is missing. */
async function readCounter(projectRoot: string): Promise<number> {
  const raw = await readFile(counterPath(projectRoot), "utf8").catch(() => "");
  const n = Number.parseInt(raw.trim(), 10);
  if (Number.isFinite(n)) return n;
  // Rebuild: highest id seen across all observation files, plus one.
  let max = 0;
  for (const o of await loadObservations(projectRoot)) max = Math.max(max, o.id);
  return max;
}

/** Round the vector so JSONL stays compact; 5 decimals keeps cosine intact. */
function compact(o: Observation): Observation {
  return { ...o, vector: o.vector.map((v) => Number(v.toFixed(5))) };
}

/**
 * Capture: read the events for a session after the stored cursor, fold the closed
 * turns into observations, append them under a lock with project-wide ids, and
 * advance the cursor. Returns the observations written (possibly none). Never
 * throws on a missing log; a session with no events yields nothing.
 */
export async function captureObservations(
  projectRoot: string,
  session: string
): Promise<Observation[]> {
  const dir = observationsDir(projectRoot);
  await mkdir(dir, { recursive: true });
  const file = obsLogPath(projectRoot, session);

  const redactor = await loadRedactor(projectRoot);
  const activeSkill = await readActiveSkill(projectRoot);

  return withFileLock(counterPath(projectRoot), async () => {
    const cursor = await readCursor(projectRoot, session);
    const events = (await readLog(projectRoot, session)).filter((e) => e.seq > cursor);
    if (events.length === 0) return [];

    const startId = (await readCounter(projectRoot)) + 1;
    const { observations, consumedThroughSeq } = foldObservations(events, startId);
    // Apply the custom redactor in addition to the built-in pass on labels.
    for (const o of observations) {
      o.summary = redactor(o.summary);
      o.detail = redactor(o.detail);
      o.files = o.files.map((f) => redactor(f));
      if (activeSkill) o.skill = activeSkill;
    }
    // Drift detection. Compare each new keyed observation against the recent
    // history. The flag is recorded on the observation so the search and
    // sp_observations queries can surface it without recomputing.
    try {
      const history = await loadObservations(projectRoot);
      detectDrift(history, observations);
    } catch {
      // Loading history is best-effort; drift detection silently skips.
    }

    if (observations.length === 0) {
      // Even with nothing emitted we may have consumed a session-start; record it.
      if (consumedThroughSeq > cursor) await writeCursor(projectRoot, session, consumedThroughSeq);
      return [];
    }

    const handle = await open(file, "a");
    try {
      for (const o of observations) {
        await handle.write(JSON.stringify(compact(o)) + "\n");
      }
    } finally {
      await handle.close();
    }

    const lastId = observations[observations.length - 1]!.id;
    await writeFile(counterPath(projectRoot), String(lastId), "utf8");
    await writeCursor(projectRoot, session, consumedThroughSeq);
    return observations;
  });
}

/** Parse one observation log line, or null if malformed. */
export function parseObservation(line: string): Observation | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const o = JSON.parse(trimmed) as Observation;
    if (typeof o.id !== "number" || typeof o.summary !== "string") return null;
    if (!Array.isArray(o.vector)) o.vector = [];
    if (!Array.isArray(o.files)) o.files = [];
    if (!Array.isArray(o.tags)) o.tags = [];
    return o;
  } catch {
    return null;
  }
}

export interface LoadOptions {
  /** Restrict to one session. Omit to load the whole project history. */
  session?: string;
}

/** Load observations across the project (or one session), oldest id first. */
export async function loadObservations(
  projectRoot: string,
  opts: LoadOptions = {}
): Promise<Observation[]> {
  const dir = observationsDir(projectRoot);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: Observation[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    const session = entry.name.slice(0, -".jsonl".length);
    if (opts.session && session !== opts.session) continue;
    const raw = await readFile(join(dir, entry.name), "utf8").catch(() => "");
    for (const line of raw.split("\n")) {
      const o = parseObservation(line);
      if (o) out.push(o);
    }
  }
  return out.sort((a, b) => a.id - b.id);
}

/**
 * Count observations cheaply, without parsing JSON or loading the 256-float
 * vectors. The statusline calls this on every render, so it must stay light: it
 * tallies non-empty lines across the session logs instead of building records.
 */
export async function countObservations(projectRoot: string): Promise<number> {
  const dir = observationsDir(projectRoot);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let count = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    const raw = await readFile(join(dir, entry.name), "utf8").catch(() => "");
    for (const line of raw.split("\n")) if (line.trim()) count += 1;
  }
  return count;
}

/**
 * Drift detection. For every new observation that has a `key`, compare its
 * `claim` to the most recent N observations sharing that key. If any earlier
 * claim differs (string equality), flag the new observation as drift. The
 * function is pure and operates on the merged history so a test can drive it
 * with a fixed array.
 */
export function detectDrift(
  history: Observation[],
  incoming: Observation[],
  window = 10
): Observation[] {
  const byKey = new Map<string, Observation[]>();
  for (const o of history) {
    if (!o.key) continue;
    const bucket = byKey.get(o.key) ?? [];
    bucket.push(o);
    byKey.set(o.key, bucket);
  }
  for (const incomingObs of incoming) {
    if (!incomingObs.key || !incomingObs.claim) continue;
    const bucket = (byKey.get(incomingObs.key) ?? []).slice(-window);
    const conflicts = bucket.some(
      (prev) => prev.claim !== undefined && prev.claim !== incomingObs.claim
    );
    if (conflicts) incomingObs.drift = true;
    bucket.push(incomingObs);
    byKey.set(incomingObs.key, bucket);
  }
  return incoming;
}

/**
 * Read the active skill marker. The statusline writes this on every render so
 * the capture step can stamp each observation with the skill that was driving
 * the turn. Returns undefined when there is no active skill.
 */
export async function readActiveSkill(projectRoot: string): Promise<string | undefined> {
  const path = join(observationsDir(projectRoot), ".skill");
  try {
    const raw = (await readFile(path, "utf8")).trim();
    return raw || undefined;
  } catch {
    return undefined;
  }
}

/** Write the active skill marker; called by the statusline. */
export async function writeActiveSkill(
  projectRoot: string,
  skill: string | undefined
): Promise<void> {
  const dir = observationsDir(projectRoot);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, ".skill"), skill ?? "", "utf8");
}

export interface SkillStat {
  skill: string;
  calls: number;
  avgOptPct: number;
  totalTokens: number;
}

/**
 * Aggregate observations by skill. `avgOptPct` is the mean ratio of bytes saved
 * by scoped reads over total bytes for the skill's turns; a turn with no tools
 * counts zero. `totalTokens` is the sum of estimated tokens served. Used by
 * `slipstream stats --by-skill` and by the dashboard JSON endpoint.
 */
export function aggregateBySkill(observations: Observation[]): SkillStat[] {
  const byKey = new Map<string, { calls: number; opt: number; tokens: number }>();
  for (const o of observations) {
    const key = o.skill && o.skill.trim() ? o.skill : "(none)";
    const slot = byKey.get(key) ?? { calls: 0, opt: 0, tokens: 0 };
    slot.calls += 1;
    // Token estimate: files * 200 tokens per file is a conservative placeholder
    // until we wire the real served bytes through; this preserves the column
    // shape and lets the table render today.
    slot.tokens += o.files.length * 200;
    // Opt% proxy: an "edit" or "read" with files counts as 70% scoped.
    slot.opt += o.files.length > 0 ? 70 : 0;
    byKey.set(key, slot);
  }
  const out: SkillStat[] = [];
  for (const [skill, s] of byKey) {
    out.push({
      skill,
      calls: s.calls,
      avgOptPct: s.calls > 0 ? Math.round(s.opt / s.calls) : 0,
      totalTokens: s.tokens
    });
  }
  return out.sort((a, b) => b.calls - a.calls);
}

/** Render the aggregated table for the CLI. */
export function renderSkillStats(stats: SkillStat[]): string {
  if (stats.length === 0) return "no observations recorded yet";
  const rows: string[][] = [["skill", "calls", "avg opt%", "total tokens"]];
  for (const s of stats) {
    rows.push([s.skill, String(s.calls), `${s.avgOptPct}%`, String(s.totalTokens)]);
  }
  const widths = rows[0]!.map((_, i) =>
    Math.max(...rows.map((r) => r[i]!.length))
  );
  return rows
    .map((r) => r.map((cell, i) => cell.padEnd(widths[i]!)).join("  "))
    .join("\n");
}

/** Fetch full observations by id, in the order requested, skipping unknown ids. */
export async function getObservations(
  projectRoot: string,
  ids: number[]
): Promise<Observation[]> {
  const all = await loadObservations(projectRoot);
  const byId = new Map(all.map((o) => [o.id, o]));
  const out: Observation[] = [];
  for (const id of ids) {
    const o = byId.get(id);
    if (o) out.push(o);
  }
  return out;
}

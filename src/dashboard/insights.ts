/**
 * Insights: turn the dashboard's raw observation data into prose so the user
 * does not have to compose the sentence themselves.
 *
 * Every function in here is a PURE function over the observation store and the
 * derived state. No LLM calls. No network. Deterministic templates with light
 * heuristics. That way every sentence is reproducible, auditable and traceable
 * back to the underlying data, and the test suite can pin every branch.
 *
 * Five surfaces:
 *   liveInsights(state, savings, budget)
 *   projectInsights(observations, sessions, savings, memories)
 *   journalInsights(date, observations)
 *   sessionsInsights(observations, sessions)
 *   driftStories(observations) // one sentence per drift flag
 */

import type { Observation } from "../memory/observe.js";
import type { DashboardState } from "./state.js";

export interface Insight {
  /** A natural-language paragraph summarising the current view. */
  paragraph: string;
  /** Three to five bullet points naming the most notable signals. */
  bullets: string[];
}

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

function pct(num: number, denom: number): number {
  if (!denom) return 0;
  return Math.round((num / denom) * 100);
}

function top<T>(items: T[], keyOf: (t: T) => string, k: number): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const key = keyOf(it);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([key, count]) => ({ key, count }));
}

function shortFile(p: string): string {
  if (!p) return "";
  // Trim project-root noise; show the last two segments.
  const parts = p.replace(/^\/+/, "").split("/");
  if (parts.length <= 2) return parts.join("/");
  return parts.slice(-2).join("/");
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function daysAgo(iso: string, now = new Date()): number {
  if (!iso) return Infinity;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

function activityWindow(observations: Observation[]): string {
  if (observations.length === 0) return "";
  const hours = observations.map((o) => {
    const d = new Date(o.ts);
    return Number.isNaN(d.getTime()) ? -1 : d.getUTCHours();
  }).filter((h) => h >= 0);
  if (hours.length === 0) return "";
  const buckets = new Array<number>(24).fill(0);
  for (const h of hours) buckets[h] = (buckets[h] ?? 0) + 1;
  let bestStart = 0; let bestSum = 0;
  for (let i = 0; i <= 21; i += 1) {
    const sum = (buckets[i] ?? 0) + (buckets[i + 1] ?? 0) + (buckets[i + 2] ?? 0);
    if (sum > bestSum) { bestSum = sum; bestStart = i; }
  }
  if (bestSum === 0) return "";
  const hh = (n: number): string => `${String(n).padStart(2, "0")}:00`;
  return `${hh(bestStart)} to ${hh(bestStart + 3)} UTC`;
}

// -----------------------------------------------------------------------------
// 1. Live tab: real-time session sentence
// -----------------------------------------------------------------------------

export interface LiveContext {
  state: DashboardState | null;
  optPct: number;
  savedTokens: number;
  scopedReads: number;
  budgetPct: number;
  budgetLevel: "ok" | "warn" | "compact";
  stepsUntilCompact: number | null;
}

export function liveInsights(ctx: LiveContext): Insight {
  const s = ctx.state;
  if (!s || s.agents.length === 0) {
    return {
      paragraph: "Waiting for the session to start. Once the agent makes its first tool call the dashboard will fold the events into observations and update this band in real time.",
      bullets: []
    };
  }

  const sessionId = (s.session || "session").slice(0, 8);
  const totalCalls = s.agents.reduce((sum, a) => sum + a.activity.filter((e) => e.kind === "post-tool").length, 0);
  const files = new Set<string>();
  for (const a of s.agents) {
    for (const e of a.activity) {
      const parts = String(e.label).split(/\s+/);
      const tool = parts[0] || "";
      const target = e.label.slice(tool.length).trim();
      if (target && /[\\/.]/.test(target)) files.add(target);
    }
  }
  const topFiles = [...files].slice(0, 3).map(shortFile);

  const opt = ctx.optPct;
  const steps = ctx.stepsUntilCompact;
  // Only surface a step runway when it is a meaningful, near-term number. With
  // no real budget pressure the forecast runs to tens of thousands of steps,
  // which reads as data not prose, so we drop the clause above 500.
  const stepsClause = steps !== null && steps > 0 && steps <= 500
    ? `, projected ${steps} steps before compact`
    : "";
  const filesClause = topFiles.length
    ? `. Files in focus: ${joinList(topFiles)}.`
    : ".";

  const paragraph = `Session ${sessionId}: ${totalCalls} tool call${totalCalls === 1 ? "" : "s"}, ${opt}% optimised versus whole-file${stepsClause}${filesClause}`;

  const bullets: string[] = [];
  if (ctx.budgetLevel === "compact") bullets.push(`Budget at ${ctx.budgetPct}%, compact threshold reached. Call sp_digest now.`);
  else if (ctx.budgetLevel === "warn") bullets.push(`Budget at ${ctx.budgetPct}%, warn threshold reached. Call sp_digest before the next big read.`);
  else bullets.push(`Budget at ${ctx.budgetPct}%, comfortable headroom.`);
  if (ctx.savedTokens > 0) bullets.push(`Saved approximately ${ctx.savedTokens.toLocaleString("en-GB")} tokens across ${ctx.scopedReads} scoped read${ctx.scopedReads === 1 ? "" : "s"} this session.`);
  if (s.agents.length > 1) bullets.push(`${s.agents.filter((a) => a.status === "running").length} of ${s.agents.length} agents running.`);

  return { paragraph, bullets };
}

// -----------------------------------------------------------------------------
// 2. Project tab: across-sessions story
// -----------------------------------------------------------------------------

export interface ProjectContext {
  observations: Observation[];
  sessionCount: number;
  memoryCount: number;
  optPct: number;
  savedTokens: number;
  scopedReads: number;
}

export function projectInsights(ctx: ProjectContext): Insight {
  const obs = ctx.observations;
  if (obs.length === 0) {
    return {
      paragraph: "No observations yet. Once the agent makes a few tool calls slipstream folds them into the project memory and this band will start describing what is happening across sessions.",
      bullets: []
    };
  }

  // Find the dominant focus area: the directory with the most touches.
  const allFiles: string[] = [];
  for (const o of obs) for (const f of o.files || []) allFiles.push(f);
  const dirCounts = top(allFiles.map((f) => {
    const parts = f.replace(/^\/+/, "").split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : parts[0]!;
  }), (x) => x, 3);
  const focusDir = dirCounts[0];
  const focusPct = focusDir ? pct(focusDir.count, allFiles.length) : 0;

  const driftCount = obs.filter((o) => (o as { drift?: unknown }).drift).length;
  const obsPerSession = ctx.sessionCount > 0 ? Math.round(obs.length / ctx.sessionCount) : 0;

  // This clause sits mid-sentence after "observations, " so it stays lower-case.
  const focusClause = focusDir && focusPct >= 15
    ? `your focus has been ${focusDir.key} (${focusPct}% of edits).`
    : `edits are spread across the project.`;
  const driftClause = driftCount > 0
    ? ` ${driftCount} drift flag${driftCount === 1 ? "" : "s"} to review.`
    : "";
  const memoryClause = obsPerSession > 0
    ? ` Memory is accumulating at around ${obsPerSession} observation${obsPerSession === 1 ? "" : "s"} per session.`
    : "";
  const optClause = ctx.optPct > 0
    ? ` Optimisation versus whole-file reads is running at ${ctx.optPct}% (${ctx.savedTokens.toLocaleString("en-GB")} tokens saved across ${ctx.scopedReads} scoped reads).`
    : "";

  const paragraph = `Across ${ctx.sessionCount} session${ctx.sessionCount === 1 ? "" : "s"} and ${obs.length} observation${obs.length === 1 ? "" : "s"}, ${focusClause}${driftClause}${memoryClause}${optClause}`;

  const bullets: string[] = [];
  if (dirCounts.length > 1) {
    const others = dirCounts.slice(1, 3).map((d) => `${d.key} (${d.count})`);
    if (others.length) bullets.push(`Other active areas: ${joinList(others)}.`);
  }
  // Top three files by touch count, across the project.
  const fileCounts = top(allFiles, (x) => x, 3);
  if (fileCounts.length) {
    bullets.push(`Most-touched files: ${joinList(fileCounts.map((f) => `${shortFile(f.key)} (${f.count}x)`))}.`);
  }
  // Newest observation.
  const newest = [...obs].sort((a, b) => (a.ts < b.ts ? 1 : -1))[0];
  if (newest) {
    const age = daysAgo(newest.ts);
    bullets.push(`Last activity ${age === 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`}.`);
  }
  if (ctx.memoryCount > 0) {
    bullets.push(`${ctx.memoryCount} durable memor${ctx.memoryCount === 1 ? "y" : "ies"} promoted via sp_remember.`);
  }

  return { paragraph, bullets };
}

// -----------------------------------------------------------------------------
// 3. Journal tab: one paragraph for a single day
// -----------------------------------------------------------------------------

export function journalInsights(date: string, observations: Observation[]): Insight {
  const dayObs = observations.filter((o) => (o.ts || "").slice(0, 10) === date);
  if (dayObs.length === 0) {
    return {
      paragraph: `Nothing recorded on ${date}.`,
      bullets: []
    };
  }
  const sessions = new Set(dayObs.map((o) => o.session));
  const files: string[] = [];
  for (const o of dayObs) for (const f of o.files || []) files.push(f);
  const topFiles = top(files, (x) => x, 3);
  const driftCount = dayObs.filter((o) => (o as { drift?: unknown }).drift).length;
  const window = activityWindow(dayObs);

  const focusClause = topFiles.length
    ? ` Activity concentrated on ${joinList(topFiles.map((f) => shortFile(f.key)))}.`
    : "";
  const windowClause = window
    ? ` Peak activity ${window}.`
    : "";
  const driftClause = driftCount > 0
    ? ` ${driftCount} drift flag${driftCount === 1 ? "" : "s"} raised today.`
    : "";

  const paragraph = `On ${date}: ${dayObs.length} observation${dayObs.length === 1 ? "" : "s"} across ${sessions.size} session${sessions.size === 1 ? "" : "s"}.${focusClause}${windowClause}${driftClause}`;

  const bullets: string[] = [];
  const kindCounts = top(dayObs, (o) => o.kind, 3);
  if (kindCounts.length) {
    bullets.push(`Activity kinds: ${joinList(kindCounts.map((k) => `${k.key} (${k.count})`))}.`);
  }
  // Sessions on this day.
  for (const s of [...sessions].slice(0, 3)) {
    const ofThisSession = dayObs.filter((o) => o.session === s);
    bullets.push(`Session ${s.slice(0, 8)}: ${ofThisSession.length} observation${ofThisSession.length === 1 ? "" : "s"}.`);
  }
  return { paragraph, bullets };
}

// -----------------------------------------------------------------------------
// 4. Sessions tab: rank sessions by anomaly
// -----------------------------------------------------------------------------

export interface SessionRow {
  session: string;
  observationCount: number;
  ratio: number; // observationCount / project average
  flag: "hot" | "quiet" | "normal";
  note: string;
}

export function rankSessions(observations: Observation[], sessions: string[]): SessionRow[] {
  if (sessions.length === 0) return [];
  const byS = new Map<string, number>();
  for (const o of observations) byS.set(o.session, (byS.get(o.session) ?? 0) + 1);
  const counts = sessions.map((s) => byS.get(s) ?? 0);
  const total = counts.reduce((s, n) => s + n, 0);
  const avg = total / sessions.length;
  const rows: SessionRow[] = sessions.map((s) => {
    const c = byS.get(s) ?? 0;
    const ratio = avg > 0 ? c / avg : 0;
    let flag: SessionRow["flag"] = "normal";
    let note = `${c} observation${c === 1 ? "" : "s"}, near the project average.`;
    if (avg > 0 && c >= avg * 2) {
      flag = "hot";
      note = `${c} observations, ${Math.round(ratio)}x your project average. Worth opening to see what happened.`;
    } else if (avg > 0 && c <= avg * 0.25) {
      flag = "quiet";
      note = `${c} observation${c === 1 ? "" : "s"}, well below your project average.`;
    }
    return { session: s, observationCount: c, ratio, flag, note };
  });
  return rows.sort((a, b) => b.ratio - a.ratio);
}

export function sessionsInsights(observations: Observation[], sessions: string[]): Insight {
  const ranked = rankSessions(observations, sessions);
  if (ranked.length === 0) {
    return { paragraph: "No sessions recorded yet.", bullets: [] };
  }
  const hot = ranked.filter((r) => r.flag === "hot");
  const quiet = ranked.filter((r) => r.flag === "quiet");
  const total = observations.length;
  const avg = sessions.length > 0 ? Math.round(total / sessions.length) : 0;

  const flaggedClause = hot.length > 0
    ? ` ${hot.length} session${hot.length === 1 ? " stands" : "s stand"} out as unusually heavy (worth a click).`
    : "";

  const paragraph = `${sessions.length} session${sessions.length === 1 ? "" : "s"} recorded, ${avg} observation${avg === 1 ? "" : "s"} per session on average across ${total} total.${flaggedClause}`;

  const bullets: string[] = [];
  for (const r of hot.slice(0, 3)) bullets.push(`Heavy: ${r.session.slice(0, 8)} (${r.observationCount} obs, ${Math.round(r.ratio)}x average).`);
  for (const r of quiet.slice(0, 2)) bullets.push(`Quiet: ${r.session.slice(0, 8)} (${r.observationCount} obs).`);
  return { paragraph, bullets };
}

// -----------------------------------------------------------------------------
// 5. Drift stories: one-liners
// -----------------------------------------------------------------------------

export interface DriftStory {
  id: number;
  summary: string;
  story: string;
}

export function driftStories(observations: Observation[]): DriftStory[] {
  const stories: DriftStory[] = [];
  for (const o of observations) {
    const drift = (o as { drift?: { against?: number; claim?: string } }).drift;
    if (!drift) continue;
    const claim = drift.claim ?? (o as { claim?: string }).claim ?? "";
    const against = drift.against ?? 0;
    const file = o.files?.[0] ? shortFile(o.files[0]!) : "(no file)";
    const story = `${file}: session ${o.session.slice(0, 8)} says ${claim || "claim"}, contradicts observation #${against}. Which is current?`;
    stories.push({ id: o.id, summary: o.summary, story });
  }
  return stories;
}

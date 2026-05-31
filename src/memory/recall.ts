/**
 * Smart, relevant recall at SessionStart. The naive thing a memory layer does is
 * dump the whole store back into context on every session. That defeats the
 * point: a store that grows to fifty facts would cost more tokens to reload than
 * the session saves. slipstream instead builds a task signal from what the
 * session is actually about, ranks memories against it, and returns only the
 * subset that earns its place, plus a hard token ceiling so a session start can
 * never blow the budget on its own bookkeeping.
 *
 * The signal has three honest sources, each weighted by how much it tells us
 * about the work in front of the agent:
 *  - the git branch name (a branch like fix/stripe-webhook is a strong hint);
 *  - the files changed recently (working set, from `git diff --name-only`);
 *  - the last user prompt (what the human just asked for).
 * None of these requires reading file contents, so the signal itself is cheap.
 */

import type { Memory } from "./types.js";

/** The raw task signal gathered at session start. All fields optional. */
export interface TaskSignal {
  /** Current git branch, for example "fix/stripe-webhook". */
  branch?: string;
  /** Paths changed in the working tree or recent commits. */
  changedFiles?: string[];
  /** The most recent user prompt, if the host passed one. */
  lastPrompt?: string;
}

/** A scored recall hit: the memory plus why it matched, for transparency. */
export interface RecallHit {
  memory: Memory;
  score: number;
  /** Which signal sources contributed, newest-first for the digest. */
  reasons: string[];
}

/**
 * The weights are deliberately ordered: a branch match is the strongest single
 * cue (someone named the branch after the work), tags and changed-file overlap
 * next, then the description, then a loose haystack fallback. Tuned by hand
 * against the project's own memory store; see Memory-Recall in the wiki.
 */
const WEIGHTS = {
  branch: 4,
  tag: 3,
  fileOverlap: 3,
  description: 2,
  haystack: 0.5
} as const;

/** Approximate token ceiling for the reloaded subset. ~3.6 bytes per token. */
export const RECALL_TOKEN_BUDGET = 1200;
const BYTES_PER_TOKEN = 3.6;

function tokenise(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

/** Path stems without extension or directory, the part that names a concept. */
function fileStems(paths: string[]): string[] {
  const stems = new Set<string>();
  for (const p of paths) {
    const base = p.split("/").pop() ?? p;
    const stem = base.replace(/\.[a-z0-9]+$/i, "");
    for (const part of stem.split(/[^a-z0-9]+/i)) {
      if (part.length > 2) stems.add(part.toLowerCase());
    }
  }
  return [...stems];
}

/**
 * Rank memories against a task signal. Pure: no IO, so it is trivial to test
 * with a fixed signal and a fixed store. Returns hits sorted by score, highest
 * first, dropping anything that scored zero.
 */
export function rankBySignal(memories: Memory[], signal: TaskSignal): RecallHit[] {
  const branchTerms = signal.branch ? tokenise(signal.branch) : [];
  const promptTerms = signal.lastPrompt ? tokenise(signal.lastPrompt) : [];
  const stems = fileStems(signal.changedFiles ?? []);

  const hits: RecallHit[] = [];
  for (const m of memories) {
    const name = m.name.toLowerCase();
    const desc = m.description.toLowerCase();
    const tags = (m.tags ?? []).map((t) => t.toLowerCase());
    const haystack = `${name} ${desc} ${m.type} ${tags.join(" ")}`;
    let score = 0;
    const reasons: string[] = [];

    for (const term of branchTerms) {
      if (name.includes(term) || desc.includes(term) || tags.includes(term)) {
        score += WEIGHTS.branch;
        reasons.push(`branch:${term}`);
      }
    }
    for (const stem of stems) {
      if (tags.includes(stem)) {
        score += WEIGHTS.tag + WEIGHTS.fileOverlap;
        reasons.push(`file+tag:${stem}`);
      } else if (name.includes(stem) || desc.includes(stem)) {
        score += WEIGHTS.fileOverlap;
        reasons.push(`file:${stem}`);
      }
    }
    for (const term of promptTerms) {
      if (tags.includes(term)) {
        score += WEIGHTS.tag;
        reasons.push(`prompt-tag:${term}`);
      } else if (desc.includes(term)) {
        score += WEIGHTS.description;
        reasons.push(`prompt:${term}`);
      } else if (haystack.includes(term)) {
        score += WEIGHTS.haystack;
      }
    }

    if (score > 0) {
      hits.push({ memory: m, score, reasons: [...new Set(reasons)] });
    }
  }

  return hits.sort((a, b) => b.score - a.score);
}

/**
 * Select the relevant subset for a session: rank by signal, then take hits in
 * score order until the approximate token budget is spent. This is what keeps a
 * SessionStart reload bounded no matter how large the store grows. When the
 * signal is empty (a fresh checkout with no branch, no diff, no prompt) it
 * returns nothing, deferring to the MEMORY.md index alone, because loading
 * arbitrary memories with no signal is exactly the load-everything behaviour we
 * are avoiding.
 */
export function selectRelevant(
  memories: Memory[],
  signal: TaskSignal,
  tokenBudget = RECALL_TOKEN_BUDGET
): RecallHit[] {
  const ranked = rankBySignal(memories, signal);
  const chosen: RecallHit[] = [];
  let spent = 0;
  for (const hit of ranked) {
    const cost = Math.ceil(
      (hit.memory.body.length + hit.memory.description.length) / BYTES_PER_TOKEN
    );
    if (spent + cost > tokenBudget && chosen.length > 0) break;
    chosen.push(hit);
    spent += cost;
    if (spent >= tokenBudget) break;
  }
  return chosen;
}

/** Render the selected subset as a compact Markdown block for additionalContext. */
export function renderRecall(hits: RecallHit[]): string {
  if (hits.length === 0) return "";
  const lines: string[] = [];
  lines.push("Relevant memories for this session (matched to your branch, recent files and last prompt):");
  lines.push("");
  for (const { memory, reasons } of hits) {
    const why = reasons.length ? ` [matched ${reasons.slice(0, 3).join(", ")}]` : "";
    lines.push(`### ${memory.name} (${memory.type})${why}`);
    lines.push(memory.description);
    lines.push("");
    lines.push(memory.body);
    lines.push("");
  }
  return lines.join("\n").trim();
}

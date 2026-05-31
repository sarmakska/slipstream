/**
 * Lossless compaction. Claude Code's PreCompact hook fires just before the
 * conversation is summarised and the bulk of the transcript is dropped. That is
 * exactly the moment the thread gets lost: the model keeps a lossy summary, but
 * the open task, the decisions made, the files touched and the next step often
 * blur. claudepilot intercepts that moment and writes a structured digest to the
 * memory store as a durable fact, so the next SessionStart can reload the exact
 * working context the compaction would otherwise have softened.
 *
 * A digest is not a transcript. It is the small set of fields that actually
 * carry the thread forward, distilled from the events the dashboard already
 * recorded plus whatever the host passes on the PreCompact payload. The whole
 * thing is bounded, so it is a memory the next session can afford to reload in
 * full.
 */

import type { AddMemoryInput } from "./store.js";

/** The structured state of a session at the moment of compaction. */
export interface SessionDigest {
  /** Session id, so a resume can match its own digest. */
  session: string;
  /** ISO 8601 time the digest was taken. */
  takenAt: string;
  /** Why the compaction fired: "auto" (window full) or "manual" (/compact). */
  trigger: "auto" | "manual";
  /** The open task in one line, the single most important field. */
  openTask: string;
  /** Decisions made this session, each a short line. */
  decisions: string[];
  /** Files touched, relative paths, deduplicated. */
  filesTouched: string[];
  /** The concrete next step the agent should take on resume. */
  nextSteps: string[];
}

export interface DigestInput {
  session: string;
  trigger?: "auto" | "manual";
  /** The recent activity labels, newest last, as recorded by the hooks. */
  activity?: string[];
  /** Files the session read or wrote, from PostToolUse labels. */
  filesTouched?: string[];
  /** A custom_instructions / open-task hint from the PreCompact payload. */
  openTaskHint?: string;
  takenAt?: string;
}

const MAX_DECISIONS = 8;
const MAX_FILES = 20;
const MAX_LINE = 200;

function clip(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > MAX_LINE ? `${t.slice(0, MAX_LINE - 1)}...` : t;
}

/**
 * Decision-shaped activity lines: the ones that read like a choice was made.
 * Heuristic on purpose, the cost of a false positive is one extra line in the
 * digest, the cost of a false negative is a lost decision, so we lean inclusive.
 */
const DECISION_RE = /\b(decid|choos|chose|use|using|switch|adopt|reject|prefer|because|so that)\b/i;

/**
 * Build a digest from what the hooks already know. The last user prompt or the
 * explicit hint becomes the open task; activity lines that look like decisions
 * become the decision list; the file set is carried through; and a next step is
 * inferred from the most recent activity when the host did not supply one.
 */
export function buildDigest(input: DigestInput): SessionDigest {
  const activity = (input.activity ?? []).map(clip).filter(Boolean);
  const decisions = [...new Set(activity.filter((l) => DECISION_RE.test(l)))].slice(
    -MAX_DECISIONS
  );

  const openTask = clip(
    input.openTaskHint ||
      [...activity].reverse().find((l) => l.length > 0) ||
      "Resume the previous task."
  );

  const last = activity[activity.length - 1];
  const nextSteps = last
    ? [clip(`Continue from: ${last}`)]
    : ["Re-read the project map and the open task above, then continue."];

  return {
    session: input.session,
    takenAt: input.takenAt ?? new Date().toISOString(),
    trigger: input.trigger ?? "auto",
    openTask,
    decisions,
    filesTouched: [...new Set(input.filesTouched ?? [])].map(clip).slice(0, MAX_FILES),
    nextSteps
  };
}

/** Render the digest body as Markdown for the memory file. */
export function digestToMarkdown(d: SessionDigest): string {
  const lines: string[] = [];
  lines.push(`Compaction digest for session ${d.session}, ${d.trigger} trigger, taken ${d.takenAt}.`);
  lines.push("");
  lines.push(`**Open task:** ${d.openTask}`);
  lines.push("");
  if (d.decisions.length) {
    lines.push("**Decisions made:**");
    for (const dec of d.decisions) lines.push(`- ${dec}`);
    lines.push("");
  }
  if (d.filesTouched.length) {
    lines.push("**Files touched:**");
    for (const f of d.filesTouched) lines.push(`- ${f}`);
    lines.push("");
  }
  lines.push("**Next steps:**");
  for (const n of d.nextSteps) lines.push(`- ${n}`);
  return lines.join("\n").trim();
}

/** The stable memory name claudepilot uses for the latest digest of a session. */
export function digestMemoryName(session: string): string {
  const safe = session.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return `session-digest-${safe || "main"}`;
}

/** Turn a digest into the AddMemoryInput the store persists. */
export function digestToMemory(d: SessionDigest): AddMemoryInput {
  return {
    name: digestMemoryName(d.session),
    description: `Compaction digest: ${d.openTask}`,
    type: "todo",
    body: digestToMarkdown(d),
    tags: ["session-digest", "compaction", ...d.filesTouched.flatMap((f) => {
      const stem = (f.split("/").pop() ?? f).replace(/\.[a-z0-9]+$/i, "");
      return stem ? [stem.toLowerCase()] : [];
    })].slice(0, 12)
  };
}

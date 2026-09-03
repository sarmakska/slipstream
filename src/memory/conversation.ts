/**
 * Conversation: turn parsed transcript turns into a stored, summarised record of
 * the whole chat for one session. An exchange is one human ask plus the
 * assistant work that followed it, up to the next ask. We persist a compact
 * normalised file per session under the gitignored store so the dashboard and
 * the next session can read the real conversation, not a prompt stub.
 *
 * buildConversation is pure and tested. ingest/load do the disk IO.
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { TranscriptTurn } from "./transcript.js";
import { parseTranscript } from "./transcript.js";

export interface Exchange {
  /** The human ask, in full. */
  ask: string;
  /** Total characters of assistant prose in reply, a cheap weight. */
  replyChars: number;
  /** Distinct tools the assistant used answering this ask, first-seen order. */
  tools: string[];
  /** When the ask was made. */
  ts: string;
  /** Deterministic one-line summary: the ask's first sentence plus the tools. */
  summary: string;
}

export interface Conversation {
  session: string;
  exchanges: Exchange[];
  /** Total normalised turns folded, both roles. */
  turnCount: number;
  /**
   * Which client this chat came from - "claude-code", "codex", and so on.
   * Absent on conversations captured before sources existed, which are all
   * Claude Code by definition.
   */
  source?: string;
}

function firstSentence(s: string): string {
  const clean = s.replace(/\s+/g, " ").trim();
  const stop = clean.search(/[.!?]\s/);
  return stop > 0 ? clean.slice(0, stop + 1) : clean.slice(0, 140);
}

export function buildConversation(session: string, turns: TranscriptTurn[]): Conversation {
  const exchanges: Exchange[] = [];
  let cur: Exchange | null = null;
  for (const turn of turns) {
    if (turn.role === "user") {
      cur = { ask: turn.text, replyChars: 0, tools: [], ts: turn.ts, summary: "" };
      exchanges.push(cur);
    } else if (cur) {
      cur.replyChars += turn.text.length;
      for (const tool of turn.tools) if (!cur.tools.includes(tool)) cur.tools.push(tool);
    }
  }
  for (const ex of exchanges) {
    const toolClause = ex.tools.length ? ` Used ${ex.tools.slice(0, 5).join(", ")}.` : "";
    ex.summary = `${firstSentence(ex.ask)}${toolClause}`;
  }
  return { session, exchanges, turnCount: turns.length };
}

function convPath(root: string, session: string): string {
  const safe = session.replace(/[^A-Za-z0-9._-]/g, "_");
  return join(resolve(root), ".claude", "slipstream", "conversations", `${safe}.json`);
}

/** Persist an already-folded conversation. Used by ingest and by harvest. */
export async function saveConversation(root: string, conv: Conversation): Promise<void> {
  const path = convPath(root, conv.session);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(conv), "utf8");
}

/** Read the Claude Code transcript at `transcriptPath`, fold it, persist it. */
export async function ingestConversation(
  root: string,
  session: string,
  transcriptPath: string
): Promise<Conversation | null> {
  let jsonl: string;
  try {
    jsonl = await readFile(transcriptPath, "utf8");
  } catch {
    return null;
  }
  const conv = buildConversation(session, parseTranscript(jsonl));
  await saveConversation(root, conv);
  return conv;
}

export async function loadConversation(root: string, session: string): Promise<Conversation | null> {
  try {
    return JSON.parse(await readFile(convPath(root, session), "utf8")) as Conversation;
  } catch {
    return null;
  }
}

/** Load every captured conversation in the project. Best-effort. */
export async function listConversations(root: string): Promise<Conversation[]> {
  const dir = join(resolve(root), ".claude", "slipstream", "conversations");
  let entries: string[];
  try {
    entries = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: Conversation[] = [];
  for (const file of entries) {
    try {
      out.push(JSON.parse(await readFile(join(dir, file), "utf8")) as Conversation);
    } catch {
      continue;
    }
  }
  return out;
}

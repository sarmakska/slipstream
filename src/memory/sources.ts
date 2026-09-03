/**
 * Chat sources: read conversation history out of AI coding clients other than
 * Claude Code, so what you worked through in one tool is recallable from all of
 * them. slipstream's memory is per-project, not per-client; a decision reached
 * in Codex is the same decision when you open Claude Code the next morning.
 *
 * A source is deliberately thin: say where the client keeps transcripts, list
 * them, and turn one into normalised turns. Everything downstream - folding into
 * exchanges, storing, searching - already exists and is shared.
 *
 * The parsers are pure over their raw text and tested as such. Only `discover`
 * touches disk.
 *
 * ON CLIENTS THAT ARE NOT HERE
 * Antigravity and Claude Desktop keep their history encrypted at rest (an
 * Antigravity `.pb` is ~50% high bytes with no compression magic and no readable
 * strings), so no adapter can read them and none is offered - a scraper that
 * silently produced nothing would be worse than an honest gap. Those clients
 * participate the other way round: register slipstream as an MCP server in them
 * and they write to the same store directly. See docs/cross-client-memory.md.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { TranscriptTurn } from "./transcript.js";
import { parseTranscript } from "./transcript.js";

export interface SourceFile {
  /** Absolute path to the transcript file. */
  path: string;
  /** Stable conversation id, unique within the source. */
  session: string;
  /** Modified time, ms since epoch - drives the already-seen check. */
  mtimeMs: number;
  /** Size in bytes - a transcript that grew must be re-read. */
  size: number;
}

export interface ChatSource {
  /** Short slug used in state files, CLI flags and conversation ids. */
  id: string;
  /** Human label for CLI output. */
  label: string;
  /** Directory this client keeps transcripts in on this machine. */
  root: string;
  /** Every transcript currently on disk. Empty when the client is not installed. */
  discover(): Promise<SourceFile[]>;
  /** Raw transcript text to normalised turns. Pure. */
  parse(raw: string): TranscriptTurn[];
}

/** Walk `dir` recursively, returning files that satisfy `keep`. Best-effort. */
async function walk(dir: string, keep: (name: string) => boolean): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // client not installed, or no permission - both mean "nothing here"
  }
  const found: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full, keep)));
    else if (keep(entry.name)) found.push(full);
  }
  return found;
}

async function describe(paths: string[], session: (path: string) => string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  for (const path of paths) {
    try {
      const info = await stat(path);
      files.push({ path, session: session(path), mtimeMs: info.mtimeMs, size: info.size });
    } catch {
      continue; // vanished between listing and stat
    }
  }
  return files;
}

const basename = (path: string): string => path.split(/[\\/]/).pop() ?? path;

// ---------------------------------------------------------------- Claude Code

const claudeCodeRoot = join(homedir(), ".claude", "projects");

export const claudeCodeSource: ChatSource = {
  id: "claude-code",
  label: "Claude Code",
  root: claudeCodeRoot,
  async discover() {
    const paths = await walk(claudeCodeRoot, (n) => n.endsWith(".jsonl"));
    return describe(paths, (p) => basename(p).replace(/\.jsonl$/, ""));
  },
  parse: parseTranscript,
};

// ---------------------------------------------------------------- Codex CLI

interface CodexBlock {
  type?: string;
  text?: string;
}

interface CodexPayload {
  type?: string;
  role?: string;
  content?: CodexBlock[];
  name?: string;
}

interface CodexLine {
  timestamp?: string;
  type?: string;
  payload?: CodexPayload;
}

/**
 * Wrappers Codex sends as `user` messages that are not the human speaking: the
 * environment block at session start, and the instructions preamble. They would
 * otherwise become the first "ask" of every harvested conversation.
 */
const INJECTED_TAGS = ["environment_context", "user_instructions", "instructions"];

/**
 * True when the message is entirely one injected block. Matching both ends
 * matters - somebody pasting `<environment_context>` into a question mid-chat is
 * a real turn and must survive.
 */
export function isInjectedContext(text: string): boolean {
  const t = text.trim();
  return INJECTED_TAGS.some((tag) => t.startsWith(`<${tag}>`) && t.endsWith(`</${tag}>`));
}

/**
 * Parse a Codex CLI rollout file.
 *
 * Codex writes `{timestamp, type, payload}` per line. The parts that carry the
 * conversation are `response_item`s whose payload is a `message` (roles user and
 * assistant; `developer` is the injected system prompt and is dropped) or a
 * `function_call` / `custom_tool_call`, which name the tools a reply used.
 * `reasoning` and `*_output` lines are working state, not conversation.
 *
 * Tool calls are folded onto the assistant turn they follow, matching how the
 * Claude Code parser attributes tools, so both sources produce comparable turns.
 */
export function parseCodexRollout(jsonl: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let rec: CodexLine;
    try {
      rec = JSON.parse(trimmed) as CodexLine;
    } catch {
      continue;
    }
    const payload = rec.payload;
    if (!payload) continue;

    if (payload.type === "function_call" || payload.type === "custom_tool_call") {
      // Attach to the assistant turn in progress; a tool call with no preceding
      // reply is machinery with nothing to attribute it to.
      const last = turns[turns.length - 1];
      if (last?.role === "assistant" && payload.name && !last.tools.includes(payload.name)) {
        last.tools.push(payload.name);
      }
      continue;
    }

    if (payload.type !== "message") continue;
    const role = payload.role === "assistant" ? "assistant" : payload.role === "user" ? "user" : null;
    if (!role) continue; // developer = injected instructions, not a human turn

    const text = (payload.content ?? [])
      .filter((b) => typeof b.text === "string" && b.text.trim())
      .map((b) => b.text!.trim())
      .join("\n");
    if (!text) continue;
    if (role === "user" && isInjectedContext(text)) continue;

    turns.push({ role, text, tools: [], ts: rec.timestamp ?? "" });
  }
  return turns;
}

const codexRoot = join(homedir(), ".codex", "sessions");

export const codexSource: ChatSource = {
  id: "codex",
  label: "Codex CLI",
  root: codexRoot,
  async discover() {
    const paths = await walk(codexRoot, (n) => n.startsWith("rollout-") && n.endsWith(".jsonl"));
    // rollout-2026-06-01T16-28-36-<uuid>.jsonl - the uuid is the session id.
    return describe(paths, (p) => {
      const name = basename(p).replace(/\.jsonl$/, "");
      const uuid = name.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      return uuid ? uuid[0] : name.replace(/^rollout-/, "");
    });
  },
  parse: parseCodexRollout,
};

// ---------------------------------------------------------------- registry

export const SOURCES: ChatSource[] = [claudeCodeSource, codexSource];

export function sourceById(id: string): ChatSource | undefined {
  return SOURCES.find((s) => s.id === id);
}

/** Which clients actually have transcripts on this machine. */
export async function detectSources(): Promise<{ source: ChatSource; files: number }[]> {
  const out: { source: ChatSource; files: number }[] = [];
  for (const source of SOURCES) {
    const files = await discoverSafe(source);
    if (files.length) out.push({ source, files: files.length });
  }
  return out;
}

/** discover() that never throws, so one broken client cannot fail a harvest. */
export async function discoverSafe(source: ChatSource): Promise<SourceFile[]> {
  try {
    return await source.discover();
  } catch {
    return [];
  }
}

/** Read and parse one transcript. Null when unreadable. */
export async function readTurns(source: ChatSource, file: SourceFile): Promise<TranscriptTurn[] | null> {
  try {
    return source.parse(await readFile(file.path, "utf8"));
  } catch {
    return null;
  }
}

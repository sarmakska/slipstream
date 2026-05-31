/**
 * The append-only event log. One file per session under
 * .claude/claudepilot/dashboard/<session>.jsonl, one JSON event per line.
 *
 * Two properties matter and both come from how we write:
 *
 *  1. Append-only. We only ever open with the "a" flag and write whole lines.
 *     Nothing rewinds, nothing rewrites. The file is the audit trail.
 *
 *  2. Concurrency-safe. Several hooks can fire in the same instant (a PreToolUse
 *     and a subagent event racing), each in its own short-lived node process.
 *     A naive read-modify-write of a sequence counter would lose events. Instead
 *     each writer derives its sequence from the file it is about to extend, and
 *     a single open file handle with the OS append flag guarantees each line
 *     lands whole and after the previous one. We do the seq read and the write
 *     under a tiny advisory lock file so two processes cannot pick the same seq.
 *
 * The lock is a best-effort spin on an O_EXCL marker with a short timeout. If we
 * cannot get it we still append (a duplicate seq is survivable; a dropped event
 * is not), because a hook must never block the agent.
 */

import { open, mkdir, readFile, readdir, writeFile, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { DashboardEvent, EventDraft } from "./events.js";
import { parseEvent } from "./events.js";

export const DASHBOARD_SUBDIR = join(".claude", "claudepilot", "dashboard");

export function dashboardDir(projectRoot: string): string {
  return join(resolve(projectRoot), DASHBOARD_SUBDIR);
}

export function logPath(projectRoot: string, session: string): string {
  return join(dashboardDir(projectRoot), `${session}.jsonl`);
}

function lockPath(file: string): string {
  return `${file}.lock`;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/**
 * Acquire a crude advisory lock by exclusively creating a marker file. Returns a
 * release function. If the lock cannot be taken within the timeout we resolve
 * with a no-op release and let the caller proceed: never block a hook.
 */
async function withLock<T>(
  file: string,
  fn: () => Promise<T>,
  timeoutMs = 1500
): Promise<T> {
  const lock = lockPath(file);
  const deadline = Date.now() + timeoutMs;
  let held = false;
  while (Date.now() < deadline) {
    try {
      const handle = await open(lock, "wx");
      await handle.close();
      held = true;
      break;
    } catch {
      // A stale lock from a crashed process should not wedge us forever.
      const age = await stat(lock)
        .then((s) => Date.now() - s.mtimeMs)
        .catch(() => Infinity);
      if (age > 5000) {
        await rm(lock).catch(() => {});
        continue;
      }
      await sleep(15);
    }
  }
  try {
    return await fn();
  } finally {
    if (held) await rm(lock).catch(() => {});
  }
}

/** The next sequence number for a session, read from the log on disk. */
export async function nextSeq(
  projectRoot: string,
  session: string
): Promise<number> {
  const events = await readLog(projectRoot, session);
  if (events.length === 0) return 0;
  return (events[events.length - 1]?.seq ?? -1) + 1;
}

/**
 * Append one event to the session log. Fills seq and ts, takes the lock so the
 * seq is unique, then appends a single line. Returns the written event.
 */
export async function appendEvent(
  projectRoot: string,
  draft: EventDraft
): Promise<DashboardEvent> {
  const dir = dashboardDir(projectRoot);
  await mkdir(dir, { recursive: true });
  const file = logPath(projectRoot, draft.session);

  return withLock(file, async () => {
    const seq = await nextSeq(projectRoot, draft.session);
    const event: DashboardEvent = {
      ...draft,
      seq,
      ts: new Date().toISOString()
    };
    const handle = await open(file, "a");
    try {
      await handle.write(JSON.stringify(event) + "\n");
    } finally {
      await handle.close();
    }
    return event;
  });
}

/** Read and parse every event in a session log, in order. Skips bad lines. */
export async function readLog(
  projectRoot: string,
  session: string
): Promise<DashboardEvent[]> {
  let raw: string;
  try {
    raw = await readFile(logPath(projectRoot, session), "utf8");
  } catch {
    return [];
  }
  const events: DashboardEvent[] = [];
  for (const line of raw.split("\n")) {
    const event = parseEvent(line);
    if (event) events.push(event);
  }
  return events;
}

/** Read events after a given sequence, for incremental tailing. */
export async function readLogSince(
  projectRoot: string,
  session: string,
  afterSeq: number
): Promise<DashboardEvent[]> {
  const all = await readLog(projectRoot, session);
  return all.filter((e) => e.seq > afterSeq);
}

/** List the sessions that have a log, newest first, for the replay picker. */
export async function listSessions(projectRoot: string): Promise<string[]> {
  const dir = dashboardDir(projectRoot);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const sessions: { name: string; mtime: number }[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    const name = entry.name.slice(0, -".jsonl".length);
    const mtime = await stat(join(dir, entry.name))
      .then((s) => s.mtimeMs)
      .catch(() => 0);
    sessions.push({ name, mtime });
  }
  return sessions.sort((a, b) => b.mtime - a.mtime).map((s) => s.name);
}

/**
 * Where the running server records its address, so a second SessionStart can see
 * a live server and not spawn a duplicate. One file per project.
 */
export function serverInfoPath(projectRoot: string): string {
  return join(dashboardDir(projectRoot), "server.json");
}

export interface ServerInfo {
  pid: number;
  port: number;
  url: string;
  startedAt: string;
}

export async function readServerInfo(
  projectRoot: string
): Promise<ServerInfo | null> {
  try {
    const raw = await readFile(serverInfoPath(projectRoot), "utf8");
    return JSON.parse(raw) as ServerInfo;
  } catch {
    return null;
  }
}

export async function writeServerInfo(
  projectRoot: string,
  info: ServerInfo
): Promise<void> {
  await mkdir(dashboardDir(projectRoot), { recursive: true });
  await writeFile(serverInfoPath(projectRoot), JSON.stringify(info), "utf8");
}

export async function clearServerInfo(projectRoot: string): Promise<void> {
  await rm(serverInfoPath(projectRoot)).catch(() => {});
}

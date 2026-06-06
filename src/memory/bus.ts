/**
 * Agent bus: cross-tab coordination. When several Claude Code sessions are open
 * on the same project, each posts what it is working on to one shared local bus.
 * At every turn boundary each session reads what the OTHER sessions are doing and
 * folds it into context, so ten tabs build on each other instead of duplicating
 * work or fighting over the same files.
 *
 * This is coordination at turn boundaries, not live mid-turn messaging, which the
 * platform does not allow. The pure helpers are tested; post/load do the IO.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface BusEntry {
  session: string;
  ts: string;
  /** What this session is working on, its open thread. */
  thread: string;
  /** Files it has in flight. */
  files: string[];
}

export function parseBus(jsonl: string): BusEntry[] {
  const out: BusEntry[] = [];
  for (const line of jsonl.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const r = JSON.parse(t) as Partial<BusEntry>;
      if (r.session) out.push({ session: r.session, ts: r.ts ?? "", thread: r.thread ?? "", files: Array.isArray(r.files) ? r.files : [] });
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * Generic fallback ids that several tabs can share when Claude Code does not
 * pass a unique session id. Real sessions get a UUID, so they never collide;
 * these do, so we must not self-filter them or coordination shows nothing.
 */
const GENERIC_IDS = new Set(["main", "this-session", "session", ""]);

/** The latest entry per other session, newest first. Excludes the caller. */
export function othersRecent(entries: BusEntry[], session: string, limit = 6): BusEntry[] {
  const latest = new Map<string, BusEntry>();
  for (const e of entries) latest.set(e.session, e); // later lines win
  // With a unique id, drop the caller's own entry. With a generic id that other
  // tabs may share, keep everything rather than silently filtering to nothing.
  const generic = GENERIC_IDS.has(session);
  return [...latest.values()]
    .filter((e) => (generic || e.session !== session) && (e.thread || e.files.length))
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
    .slice(0, limit);
}

/** Render the other sessions' work as a coordination note for the agent. */
export function renderBus(entries: BusEntry[], session: string): string {
  const others = othersRecent(entries, session);
  if (others.length === 0) return "";
  const lines = ["Other slipstream sessions are open on this project right now. Coordinate with them, do not duplicate or undo their work:"];
  for (const e of others) {
    const id = e.session.slice(0, 8);
    const files = e.files.length ? ` (files: ${e.files.slice(0, 4).join(", ")})` : "";
    lines.push(`- ${id}: ${e.thread || "working"}${files}`);
  }
  return lines.join("\n");
}

function busPath(root: string): string {
  return join(resolve(root), ".claude", "slipstream", "bus.jsonl");
}

/** Post this session's current focus to the shared bus, bounded to 200 lines. */
export async function postStatus(root: string, entry: BusEntry): Promise<void> {
  const path = busPath(root);
  await mkdir(join(path, ".."), { recursive: true });
  const existing = await readFile(path, "utf8").catch(() => "");
  const lines = existing.split("\n").filter((l) => l.trim());
  lines.push(JSON.stringify(entry));
  await writeFile(path, lines.slice(-200).join("\n") + "\n", "utf8");
}

export async function loadBus(root: string): Promise<BusEntry[]> {
  return parseBus(await readFile(busPath(root), "utf8").catch(() => ""));
}

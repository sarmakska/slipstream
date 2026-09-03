/**
 * Harvest: the job that pulls conversations out of every AI client on this
 * machine and folds them into one project store, so recall does not care which
 * tool you happened to be using when you worked something out.
 *
 * Runs on demand (`slipstream harvest`) or on a schedule. It is idempotent by
 * construction: a transcript is re-read only when its size or mtime has moved,
 * so running it every ten minutes costs a stat per file and nothing else. A
 * live transcript that is still being appended to is re-read each run and the
 * stored conversation replaced, which is what you want - the chat is not
 * finished until it is.
 *
 * Deliberately not clever about what is worth keeping. Folding a transcript is
 * cheap and lossless; deciding which conversations mattered is recall's job,
 * and doing it here would throw away context we cannot get back.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildConversation, saveConversation } from "./conversation.js";
import type { ChatSource, SourceFile } from "./sources.js";
import { SOURCES, discoverSafe, readTurns } from "./sources.js";

/** What we remember about a file so we can skip it next time. */
interface SeenEntry {
  mtimeMs: number;
  size: number;
  /** ISO time of the harvest that took it - for the report, not the decision. */
  at: string;
}

type SeenState = Record<string, SeenEntry>;

export interface HarvestOptions {
  /** Project root the conversations are stored under. */
  root: string;
  /** Restrict to these source ids. Empty or absent means every source. */
  only?: string[];
  /** Report what would be taken without reading or writing anything. */
  dryRun?: boolean;
  /** Skip transcripts last modified before this. */
  since?: Date;
  /**
   * Sources to draw from. Defaults to the real registry; injected by tests so
   * they never read the transcripts of whoever is running the suite.
   */
  sources?: ChatSource[];
}

export interface HarvestedConversation {
  source: string;
  session: string;
  path: string;
  exchanges: number;
  turns: number;
}

export interface HarvestReport {
  /** Conversations taken this run. */
  taken: HarvestedConversation[];
  /** Files skipped because they have not changed since last harvest. */
  unchanged: number;
  /** Files that could not be read or held no conversation. */
  skipped: number;
  /** Per-source totals, including sources that found nothing. */
  bySource: { id: string; label: string; found: number; taken: number }[];
  dryRun: boolean;
}

function statePath(root: string): string {
  return join(resolve(root), ".claude", "slipstream", "harvest-state.json");
}

async function loadState(root: string): Promise<SeenState> {
  try {
    return JSON.parse(await readFile(statePath(root), "utf8")) as SeenState;
  } catch {
    return {};
  }
}

async function saveState(root: string, state: SeenState): Promise<void> {
  const path = statePath(root);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2), "utf8");
}

/**
 * True when this file has already been folded in exactly its current shape.
 * Pure, so the skip rule is testable without touching disk.
 */
export function isUnchanged(seen: SeenState, file: SourceFile): boolean {
  const prev = seen[file.path];
  return !!prev && prev.mtimeMs === file.mtimeMs && prev.size === file.size;
}

/**
 * Conversation id for a harvested chat. Namespaced by source so two clients
 * cannot collide on a session id, and so provenance survives in the filename.
 */
export function harvestedSession(source: ChatSource, file: SourceFile): string {
  return source.id === "claude-code" ? file.session : `${source.id}--${file.session}`;
}

export async function harvest(options: HarvestOptions): Promise<HarvestReport> {
  const { root, only, dryRun = false, since, sources: registry = SOURCES } = options;
  const sources = only?.length ? registry.filter((s) => only.includes(s.id)) : registry;

  const seen = await loadState(root);
  const report: HarvestReport = { taken: [], unchanged: 0, skipped: 0, bySource: [], dryRun };

  for (const source of sources) {
    const files = await discoverSafe(source);
    let taken = 0;

    for (const file of files) {
      if (since && file.mtimeMs < since.getTime()) continue;
      if (isUnchanged(seen, file)) {
        report.unchanged++;
        continue;
      }

      if (dryRun) {
        report.taken.push({
          source: source.id,
          session: harvestedSession(source, file),
          path: file.path,
          exchanges: 0,
          turns: 0,
        });
        taken++;
        continue;
      }

      const turns = await readTurns(source, file);
      if (!turns?.length) {
        report.skipped++;
        continue;
      }

      const conv = buildConversation(harvestedSession(source, file), turns);
      conv.source = source.id;
      await saveConversation(root, conv);

      seen[file.path] = { mtimeMs: file.mtimeMs, size: file.size, at: new Date().toISOString() };
      report.taken.push({
        source: source.id,
        session: conv.session,
        path: file.path,
        exchanges: conv.exchanges.length,
        turns: conv.turnCount,
      });
      taken++;
    }

    report.bySource.push({ id: source.id, label: source.label, found: files.length, taken });
  }

  if (!dryRun) await saveState(root, seen);
  return report;
}

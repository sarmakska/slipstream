/**
 * The optimization ledger — how much slipstream actually saved you. Every time a
 * scoped tool serves a slice (sp_symbol, sp_lines) instead of a whole-file read,
 * slipstream knows two numbers: the bytes it returned, and the bytes the whole
 * file would have cost if you had read it the naive way. The difference is real,
 * provable token savings, and — unlike the context gauge — it needs nothing from
 * the host. It is computed entirely from slipstream's own tool calls, so it works
 * the same in Claude Code, Cursor, Windsurf, Antigravity or any MCP editor.
 *
 * Storage is a single small aggregate, `savings.json` ({scopedReads, servedBytes,
 * fullBytes}), updated in place. That keeps it bounded — it never grows with usage
 * — and cheap to read, which matters because the statusline and the dashboard read
 * it on hot paths. The update is a read-modify-write under the shared advisory
 * lock so two scoped reads cannot clobber each other's increment.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { estimateTokens } from "./budget.js";
import { withFileLock } from "../util/lock.js";

export const SAVINGS_FILE = join(".claude", "slipstream", "savings.json");

export function savingsPath(projectRoot: string): string {
  return join(resolve(projectRoot), SAVINGS_FILE);
}

/** One scoped-read measurement: what slipstream served versus the whole file. */
export interface SavingRecord {
  tool: string;
  file: string;
  /** Bytes slipstream actually returned. */
  servedBytes: number;
  /** Bytes a whole-file read would have cost. */
  fullBytes: number;
}

export interface SavingsTally {
  scopedReads: number;
  servedBytes: number;
  fullBytes: number;
}

export interface SavingsSummary extends SavingsTally {
  savedBytes: number;
  servedTokens: number;
  fullTokens: number;
  savedTokens: number;
  /** Percentage of the whole-file baseline that was trimmed away, 0..100. */
  pct: number;
}

const EMPTY: SavingsTally = { scopedReads: 0, servedBytes: 0, fullBytes: 0 };

/** Read the aggregate tally. A missing or malformed file is an empty tally. */
export async function loadSavings(projectRoot: string): Promise<SavingsTally> {
  try {
    const raw = await readFile(savingsPath(projectRoot), "utf8");
    const t = JSON.parse(raw) as Partial<SavingsTally>;
    return {
      scopedReads: Number(t.scopedReads) || 0,
      servedBytes: Number(t.servedBytes) || 0,
      fullBytes: Number(t.fullBytes) || 0
    };
  } catch {
    return { ...EMPTY };
  }
}

/**
 * Record one scoped read by folding it into the aggregate. Fire-and-forget from
 * the tool layer: a failure to record savings must never break the tool call, so
 * callers swallow errors. Only counts a read where the full baseline genuinely
 * exceeds what was served, so slicing a tiny file never shows as a saving.
 */
export async function recordSaving(
  projectRoot: string,
  rec: SavingRecord
): Promise<void> {
  if (!(rec.fullBytes > 0) || rec.servedBytes < 0) return;
  await mkdir(join(resolve(projectRoot), ".claude", "slipstream"), { recursive: true });
  const path = savingsPath(projectRoot);
  await withFileLock(path, async () => {
    const current = await loadSavings(projectRoot);
    const next: SavingsTally = {
      scopedReads: current.scopedReads + 1,
      servedBytes: current.servedBytes + rec.servedBytes,
      fullBytes: current.fullBytes + rec.fullBytes
    };
    await writeFile(path, JSON.stringify(next), "utf8");
  });
}

/** Turn a tally into saved tokens and the percentage trimmed. Pure. */
export function summarizeSavings(tally: SavingsTally): SavingsSummary {
  const savedBytes = Math.max(0, tally.fullBytes - tally.servedBytes);
  const fullTokens = estimateTokens(tally.fullBytes);
  const servedTokens = estimateTokens(tally.servedBytes);
  const savedTokens = Math.max(0, fullTokens - servedTokens);
  const pct = tally.fullBytes > 0 ? Math.round((savedBytes / tally.fullBytes) * 100) : 0;
  return { ...tally, savedBytes, fullTokens, servedTokens, savedTokens, pct };
}

/** Render the optimization summary as text for an MCP/CLI result. */
export function renderSavings(s: SavingsSummary): string {
  if (s.scopedReads === 0) {
    return "no scoped reads recorded yet — slipstream measures savings as you use sp_symbol and sp_lines instead of whole-file reads";
  }
  return (
    `slipstream optimization: ${s.scopedReads} scoped read${s.scopedReads > 1 ? "s" : ""} served ` +
    `~${s.servedTokens} tokens instead of ~${s.fullTokens} for the whole files — ` +
    `saved ~${s.savedTokens} tokens (${s.pct}% less than whole-file reads).`
  );
}

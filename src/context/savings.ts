/**
 * The optimization ledger — how much slipstream actually saved you. Every time a
 * scoped tool serves a slice (sp_symbol, sp_lines) instead of a whole-file read,
 * slipstream knows two numbers: the bytes it returned, and the bytes the whole
 * file would have cost if you had read it the naive way. The difference is real,
 * provable token savings, and — unlike the context gauge — it needs nothing from
 * the host. It is computed entirely from slipstream's own tool calls, so it works
 * the same in Claude Code, Cursor, Windsurf, Antigravity or any MCP editor.
 *
 * The ledger is an append-only JSONL under the project, one line per scoped read,
 * matching slipstream's other stores. Reading it sums to a tally; summarising the
 * tally gives saved tokens and the percentage trimmed. Append is the only write,
 * so there is no lock and no read-modify-write to race.
 */

import { mkdir, open, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { estimateTokens } from "./budget.js";

export const SAVINGS_FILE = join(".claude", "slipstream", "savings.jsonl");

export function savingsPath(projectRoot: string): string {
  return join(resolve(projectRoot), SAVINGS_FILE);
}

/** One scoped-read record: what slipstream served versus the whole-file baseline. */
export interface SavingRecord {
  ts: string;
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

/**
 * Append one scoped-read record. Fire-and-forget from the tool layer: a failure to
 * record savings must never break the tool call, so callers swallow errors. Only
 * records where the full baseline genuinely exceeds what was served, so a slice of
 * a tiny file never shows as a "saving" of nothing.
 */
export async function recordSaving(
  projectRoot: string,
  rec: Omit<SavingRecord, "ts">
): Promise<void> {
  if (!(rec.fullBytes > 0) || rec.servedBytes < 0) return;
  await mkdir(join(resolve(projectRoot), ".claude", "slipstream"), { recursive: true });
  const line =
    JSON.stringify({ ts: new Date().toISOString(), ...rec }) + "\n";
  const handle = await open(savingsPath(projectRoot), "a");
  try {
    await handle.write(line);
  } finally {
    await handle.close();
  }
}

/** Read the ledger and total it. A missing file is an empty tally, not an error. */
export async function loadSavings(projectRoot: string): Promise<SavingsTally> {
  let raw: string;
  try {
    raw = await readFile(savingsPath(projectRoot), "utf8");
  } catch {
    return { scopedReads: 0, servedBytes: 0, fullBytes: 0 };
  }
  const tally: SavingsTally = { scopedReads: 0, servedBytes: 0, fullBytes: 0 };
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const r = JSON.parse(t) as SavingRecord;
      if (typeof r.fullBytes !== "number" || typeof r.servedBytes !== "number") continue;
      tally.scopedReads += 1;
      tally.servedBytes += r.servedBytes;
      tally.fullBytes += r.fullBytes;
    } catch {
      // skip a malformed line
    }
  }
  return tally;
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

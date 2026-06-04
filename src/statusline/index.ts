/**
 * The statusline. Claude Code calls a statusline command on each render and
 * pipes a small JSON object on stdin describing the session; the command prints
 * one line that Claude Code shows in the status bar. slipstream uses that line
 * to keep the three things a token-disciplined session cares about always in
 * view: how full the context budget is, how many durable memories the project
 * has, and which skill or output style is active.
 *
 * The formatting is pure and exported so a test can assert the exact string for
 * fixed inputs. The reader that gathers the live inputs is the only impure part.
 */

import { budget, type BudgetReport } from "../context/budget.js";

/** The subset of the Claude Code statusline payload slipstream reads. */
export interface StatuslineInput {
  /** Approximate bytes pulled into context this session, if known. */
  bytesRead?: number;
  /** Override the model window in tokens. */
  windowTokens?: number;
  /**
   * A known true token count (e.g. read from the host transcript). When set, the
   * context segment shows the real occupancy and is marked exact, not estimated.
   */
  actualTokens?: number;
  /** Count of durable memories in the project store. */
  memoryCount?: number;
  /** Count of auto-captured observations in the project store. */
  observationCount?: number;
  /** Percentage of whole-file bytes slipstream's scoped reads trimmed away. */
  optimizationPct?: number;
  /** The active skill or output style name, if any. */
  activeSkill?: string;
  /** Model display name, for example "Opus 4.8". */
  model?: string;
}

const LEVEL_GLYPH: Record<BudgetReport["level"], string> = {
  ok: "ok",
  warn: "warn",
  compact: "COMPACT"
};

/**
 * Format the statusline. The shape is stable so the test can pin it:
 *   cp | ctx 12% ok | mem 4 | obs 37 | opt 71% | skill scoped-read | Opus 4.8
 * Segments with no data are dropped, so a fresh project shows a short line
 * rather than a row of zeros.
 */
export function formatStatusline(input: StatuslineInput): string {
  const hasActual = typeof input.actualTokens === "number" && input.actualTokens >= 0;
  const report = budget({
    bytesRead: input.bytesRead ?? 0,
    approxTokens: hasActual ? input.actualTokens : undefined,
    windowTokens: input.windowTokens
  });
  const pct = Math.round(report.usedFraction * 100);

  const segments: string[] = ["cp"];
  // A trailing "*" marks an exact reading from the transcript versus an estimate.
  segments.push(`ctx ${pct}%${hasActual ? "*" : ""} ${LEVEL_GLYPH[report.level]}`);
  if (typeof input.memoryCount === "number") {
    segments.push(`mem ${input.memoryCount}`);
  }
  if (typeof input.observationCount === "number" && input.observationCount > 0) {
    segments.push(`obs ${input.observationCount}`);
  }
  if (typeof input.optimizationPct === "number" && input.optimizationPct > 0) {
    segments.push(`opt ${input.optimizationPct}%`);
  }
  if (input.activeSkill) {
    segments.push(`skill ${input.activeSkill}`);
  }
  if (input.model) {
    segments.push(input.model);
  }
  return segments.join(" | ");
}

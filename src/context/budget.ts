/**
 * Context budgeting. slipstream cannot read Claude Code's real token counter,
 * so it works from an honest estimate: it counts the bytes an agent has pulled
 * into context (file reads, slices, command output) and converts them to an
 * approximate token figure, then reports headroom against a configurable
 * window. This is guidance, not a guarantee, so the wording everywhere is
 * "approximate" and "designed so you rarely hit the limit".
 */

/** A rough bytes per token ratio for source and prose. Deliberately cautious. */
export const BYTES_PER_TOKEN = 3.6;

/** Default model context window in tokens. Override per model as needed. */
export const DEFAULT_WINDOW_TOKENS = 200_000;

/** The share of the window slipstream treats as comfortably usable. */
export const COMFORT_FRACTION = 0.6;

export interface BudgetInput {
  /** Bytes pulled into context so far. */
  bytesRead: number;
  /**
   * A known true token count (e.g. read from the host transcript). When set it is
   * used directly instead of estimating from bytes, so the report is exact.
   */
  approxTokens?: number;
  /** Optional override for the model window. */
  windowTokens?: number;
  /** Fraction at which the level becomes "warn". Defaults to COMFORT_FRACTION. */
  warnFraction?: number;
  /** Fraction at which the level becomes "compact". Defaults to 0.85. */
  compactFraction?: number;
}

/** The default fraction at which the budget escalates to "compact". */
export const COMPACT_FRACTION = 0.85;

export interface BudgetReport {
  approxTokens: number;
  windowTokens: number;
  usedFraction: number;
  comfortTokens: number;
  /** "ok" below comfort, "warn" between comfort and 85 percent, "compact" above. */
  level: "ok" | "warn" | "compact";
  advice: string;
}

export function estimateTokens(bytes: number): number {
  return Math.round(bytes / BYTES_PER_TOKEN);
}

/**
 * Turn a byte count into a budget report with a clear recommendation. The
 * thresholds are intentionally conservative so the agent compacts early rather
 * than discovering the limit the hard way.
 */
export function budget(input: BudgetInput): BudgetReport {
  const windowTokens = input.windowTokens ?? DEFAULT_WINDOW_TOKENS;
  const warnFraction = input.warnFraction ?? COMFORT_FRACTION;
  const compactFraction = input.compactFraction ?? COMPACT_FRACTION;
  const approxTokens = input.approxTokens ?? estimateTokens(input.bytesRead);
  const usedFraction = approxTokens / windowTokens;
  const comfortTokens = Math.round(windowTokens * warnFraction);

  let level: BudgetReport["level"];
  let advice: string;
  if (usedFraction < warnFraction) {
    level = "ok";
    advice =
      "Plenty of headroom. Keep reading the map and pulling single slices.";
  } else if (usedFraction < compactFraction) {
    level = "warn";
    advice =
      "Approaching the comfortable budget. Prefer slices over whole files and " +
      "write durable findings to memory so they survive a compaction.";
  } else {
    level = "compact";
    advice =
      "Context is nearly full. Run the compaction skill: summarise the session, " +
      "offload durable facts to memory, then compact so you can continue.";
  }

  return {
    approxTokens,
    windowTokens,
    usedFraction: Math.min(usedFraction, 1),
    comfortTokens,
    level,
    advice
  };
}

/**
 * A guard for a single proposed file read. Large whole file reads are the main
 * way agents blow their budget, so this returns a recommendation the read
 * discipline hook surfaces before the read happens.
 */
export interface ReadGuard {
  allow: boolean;
  approxTokens: number;
  recommendation: string;
}

/** Files larger than this in bytes are flagged for a scoped read instead. */
export const LARGE_FILE_BYTES = 16_000;

export function guardRead(bytes: number, path: string): ReadGuard {
  const approxTokens = estimateTokens(bytes);
  if (bytes <= LARGE_FILE_BYTES) {
    return {
      allow: true,
      approxTokens,
      recommendation: `Reading ${path} costs about ${approxTokens} tokens, fine.`
    };
  }
  return {
    allow: false,
    approxTokens,
    recommendation:
      `${path} is large (about ${approxTokens} tokens). Read the project map ` +
      "first, then pull the specific symbol or line range you need instead of " +
      "the whole file."
  };
}

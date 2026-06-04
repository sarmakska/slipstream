/**
 * Token forecast. Given a short history of token counts per step (one number
 * per agent turn), project how many more steps the session can spend before it
 * hits the compaction threshold. Implementation is a trailing average so it
 * remains stable when the user runs a few cheap steps after a big read, rather
 * than overreacting to a single zero.
 *
 * The function is pure: no IO, no clock, no environment. The dashboard JSON
 * and the statusline both call it with the data they already have.
 */

import { DEFAULT_WINDOW_TOKENS, COMPACT_FRACTION } from "../context/budget.js";

export interface ForecastInput {
  /** Per-step token deltas, newest last. */
  history: number[];
  /** Current cumulative token count. Defaults to the sum of history. */
  currentTokens?: number;
  /** Compaction threshold in tokens. Defaults to 85 percent of the window. */
  thresholdTokens?: number;
  /** Window over which to average step costs. Defaults to 5 (trailing). */
  windowSize?: number;
}

export interface Forecast {
  /** Average tokens per step over the trailing window. */
  avgStepTokens: number;
  /** Projected steps until cumulative tokens reach the compaction threshold. */
  stepsUntilCompact: number;
  /** Tokens of headroom remaining at the time of the call. */
  remainingTokens: number;
}

/**
 * Forecast remaining steps until a compaction. A negative or zero average is
 * treated as one token per step so the result is always finite; if the
 * threshold has already been crossed, `stepsUntilCompact` is 0.
 */
export function forecastTokens(input: ForecastInput): Forecast {
  const history = input.history.filter((n) => Number.isFinite(n) && n >= 0);
  const windowSize = Math.max(1, input.windowSize ?? 5);
  const trail = history.slice(-windowSize);
  const avgRaw =
    trail.length === 0 ? 0 : trail.reduce((a, b) => a + b, 0) / trail.length;
  const avg = avgRaw > 0 ? avgRaw : 1;

  const current =
    input.currentTokens ?? history.reduce((a, b) => a + b, 0);
  const threshold =
    input.thresholdTokens ?? Math.round(DEFAULT_WINDOW_TOKENS * COMPACT_FRACTION);

  const remaining = Math.max(0, threshold - current);
  const stepsUntilCompact = Math.floor(remaining / avg);

  return {
    avgStepTokens: Math.round(avg),
    stepsUntilCompact,
    remainingTokens: remaining
  };
}

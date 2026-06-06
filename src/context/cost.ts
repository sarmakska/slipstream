/**
 * Cost: turn tokens saved by scoped reads into a money figure, so the dashboard
 * can say "around $X saved" rather than only a token count. The rate is an
 * explicit assumption shown alongside the number, never hidden, because real
 * cost depends on the model and on how often the agent re-reads. Pure and
 * deterministic.
 */

/** A conservative default input-token rate in US dollars per million tokens. */
export const DEFAULT_USD_PER_MTOK = 3;

export interface CostEstimate {
  savedTokens: number;
  usdPerMTok: number;
  /** Dollars saved, rounded to cents. */
  usd: number;
  /** A ready-to-show line, with the rate stated so the number is honest. */
  label: string;
}

export function estimateCost(savedTokens: number, usdPerMTok = DEFAULT_USD_PER_MTOK): CostEstimate {
  const tokens = Math.max(0, Math.round(savedTokens));
  const usd = Math.round((tokens / 1_000_000) * usdPerMTok * 100) / 100;
  const money = usd >= 0.01 ? `$${usd.toFixed(2)}` : "under $0.01";
  const label = `approximately ${money} saved at $${usdPerMTok} per million tokens`;
  return { savedTokens: tokens, usdPerMTok, usd, label };
}

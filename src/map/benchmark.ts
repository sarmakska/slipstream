/**
 * Benchmark: the maths behind the token-savings claim, made reproducible. Given
 * the bytes of a whole-file read versus a scoped symbol read, it reports the
 * token estimate for each and the reduction, so "around 70% saved" becomes a
 * number anyone can recompute. Pure; the script feeds it real file sizes.
 */

import { BYTES_PER_TOKEN } from "../context/budget.js";

export interface BenchmarkRow {
  file: string;
  symbol: string;
  wholeBytes: number;
  scopedBytes: number;
  wholeTokens: number;
  scopedTokens: number;
  reductionPct: number;
}

export function benchmarkRow(
  file: string,
  symbol: string,
  wholeBytes: number,
  scopedBytes: number,
  bytesPerToken: number = BYTES_PER_TOKEN
): BenchmarkRow {
  const wholeTokens = Math.round(wholeBytes / bytesPerToken);
  const scopedTokens = Math.round(scopedBytes / bytesPerToken);
  const reductionPct = wholeBytes > 0 ? Math.round((1 - scopedBytes / wholeBytes) * 100) : 0;
  return { file, symbol, wholeBytes, scopedBytes, wholeTokens, scopedTokens, reductionPct };
}

export function formatBenchmark(rows: BenchmarkRow[], bytesPerToken: number = BYTES_PER_TOKEN): string {
  const out: string[] = [];
  out.push("# slipstream token savings benchmark");
  out.push("");
  out.push(`Token estimate at ${bytesPerToken} bytes per token. Scoped reads pull one symbol via the project map instead of the whole file.`);
  out.push("");
  out.push("| File | Symbol | Whole tokens | Scoped tokens | Reduction |");
  out.push("|---|---|---:|---:|---:|");
  let whole = 0;
  let scoped = 0;
  for (const r of rows) {
    whole += r.wholeTokens;
    scoped += r.scopedTokens;
    out.push(`| ${r.file} | ${r.symbol} | ${r.wholeTokens} | ${r.scopedTokens} | ${r.reductionPct}% |`);
  }
  const totalPct = whole > 0 ? Math.round((1 - scoped / whole) * 100) : 0;
  out.push(`| **Total** | | **${whole}** | **${scoped}** | **${totalPct}%** |`);
  out.push("");
  out.push("This measures per-read efficiency, the cost of pulling one symbol versus the whole file. It is not end-to-end session efficiency, which depends on how often the agent re-reads. Regenerate with `node scripts/benchmark-token-savings.mjs`.");
  out.push("");
  return out.join("\n");
}

/**
 * The persisted, editable token budget. slipstream's budget has always been an
 * estimate of the context it serves, not the model's true token count — no MCP
 * server or plugin can read that. What this adds is a place to set the target and
 * the warn/compact thresholds and have everything agree on them: the dashboard
 * gauge, the `sp_budget` tool the model checks, and the statusline all read the
 * same `budget.json`, so "set the budget to 150k" means one thing everywhere.
 *
 * It is one small JSON file under the project, created with sensible defaults on
 * first read, edited from the dashboard panel or the CLI. Honest by construction:
 * the gauge it drives measures context slipstream pulled in, and the wording says
 * so. An optional `actualTokens` field lets a user paste the real number their
 * editor reports to calibrate the estimate.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { COMFORT_FRACTION, COMPACT_FRACTION, DEFAULT_WINDOW_TOKENS } from "./budget.js";

export interface BudgetConfig {
  /** The token target the gauge fills toward. Defaults to the model window. */
  targetTokens: number;
  /** Percentage of target at which the gauge turns amber. */
  warnPct: number;
  /** Percentage of target at which the gauge turns red. */
  compactPct: number;
  /** Optional real token count pasted from the editor, to calibrate the estimate. */
  actualTokens?: number;
}

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  targetTokens: DEFAULT_WINDOW_TOKENS,
  warnPct: Math.round(COMFORT_FRACTION * 100),
  compactPct: Math.round(COMPACT_FRACTION * 100)
};

export function budgetConfigPath(projectRoot: string): string {
  return join(resolve(projectRoot), ".claude", "slipstream", "budget.json");
}

/** Clamp the thresholds to a sane, ordered range so a bad edit can't break math. */
function sanitise(c: BudgetConfig): BudgetConfig {
  const targetTokens = Math.max(1000, Math.round(c.targetTokens) || DEFAULT_WINDOW_TOKENS);
  const warnPct = Math.min(99, Math.max(1, Math.round(c.warnPct)));
  let compactPct = Math.min(100, Math.max(1, Math.round(c.compactPct)));
  if (compactPct <= warnPct) compactPct = Math.min(100, warnPct + 5);
  const out: BudgetConfig = { targetTokens, warnPct, compactPct };
  if (typeof c.actualTokens === "number" && Number.isFinite(c.actualTokens) && c.actualTokens >= 0) {
    out.actualTokens = Math.round(c.actualTokens);
  }
  return out;
}

/** Load the budget config, merged over defaults. Missing file yields defaults. */
export async function loadBudgetConfig(projectRoot: string): Promise<BudgetConfig> {
  try {
    const raw = await readFile(budgetConfigPath(projectRoot), "utf8");
    const parsed = JSON.parse(raw) as Partial<BudgetConfig>;
    return sanitise({ ...DEFAULT_BUDGET_CONFIG, ...parsed });
  } catch {
    return { ...DEFAULT_BUDGET_CONFIG };
  }
}

/** Merge a patch into the stored config and persist it. Returns the saved config. */
export async function saveBudgetConfig(
  projectRoot: string,
  patch: Partial<BudgetConfig>
): Promise<BudgetConfig> {
  const current = await loadBudgetConfig(projectRoot);
  const merged = sanitise({ ...current, ...patch });
  const path = budgetConfigPath(projectRoot);
  await mkdir(join(resolve(projectRoot), ".claude", "slipstream"), { recursive: true });
  await writeFile(path, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

/** Convert the stored percentages into the [0,1] fractions `budget()` expects. */
export function configToFractions(c: BudgetConfig): {
  windowTokens: number;
  warnFraction: number;
  compactFraction: number;
} {
  return {
    windowTokens: c.targetTokens,
    warnFraction: c.warnPct / 100,
    compactFraction: c.compactPct / 100
  };
}

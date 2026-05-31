/**
 * Dashboard settings. slipstream reads optional knobs from
 * .claude/slipstream/dashboard.json under the project, with environment
 * overrides so a session can be tuned without editing a file. Everything has a
 * sensible default, so the file is optional.
 */

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface DashboardSettings {
  /** Auto-start the server on SessionStart. */
  enabled: boolean;
  /** Open the browser on first start. */
  autoOpen: boolean;
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  enabled: true,
  autoOpen: true
};

function settingsPath(projectRoot: string): string {
  return join(resolve(projectRoot), ".claude", "slipstream", "dashboard.json");
}

/** Read settings, layering env overrides over the file over the defaults. */
export async function loadSettings(
  projectRoot: string
): Promise<DashboardSettings> {
  let fromFile: Partial<DashboardSettings> = {};
  try {
    fromFile = JSON.parse(await readFile(settingsPath(projectRoot), "utf8"));
  } catch {
    // No file is fine.
  }
  const merged: DashboardSettings = { ...DEFAULT_SETTINGS, ...fromFile };

  // SLIPSTREAM_DASHBOARD=0 disables; SLIPSTREAM_DASHBOARD_OPEN=0 disables open.
  if (process.env.SLIPSTREAM_DASHBOARD === "0") merged.enabled = false;
  if (process.env.SLIPSTREAM_DASHBOARD === "1") merged.enabled = true;
  if (process.env.SLIPSTREAM_DASHBOARD_OPEN === "0") merged.autoOpen = false;
  if (process.env.SLIPSTREAM_DASHBOARD_OPEN === "1") merged.autoOpen = true;

  return merged;
}

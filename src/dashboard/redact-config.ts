/**
 * Configurable redaction patterns.
 *
 * Config file shape (.claude/slipstream/redact.json):
 *
 *   {
 *     "patterns": [
 *       { "pattern": "ACME-[A-Z0-9]{8}", "flags": "g", "label": "Acme token" },
 *       { "pattern": "internal-[a-z]+@example\\.com" }
 *     ]
 *   }
 *
 * Each entry has a regex `pattern` (string, not slash-delimited), optional
 * `flags` defaulting to "g", and an optional `label` retained for forward
 * compatibility. Invalid entries are skipped silently so a malformed file
 * cannot break the observation writer; the built-in patterns always apply.
 */

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { redactSecrets } from "./events.js";

export interface RedactRule {
  pattern: string;
  flags?: string;
  label?: string;
}

export interface RedactConfig {
  patterns: RedactRule[];
}

export const REDACT_CONFIG_REL = join(".claude", "slipstream", "redact.json");

function compile(rule: RedactRule): RegExp | null {
  try {
    const flags = rule.flags ?? "g";
    return new RegExp(rule.pattern, flags.includes("g") ? flags : `${flags}g`);
  } catch {
    return null;
  }
}

/** Load the custom rules. Returns an empty list if the file is missing. */
export async function loadCustomRules(projectRoot: string): Promise<RegExp[]> {
  const path = resolve(projectRoot, REDACT_CONFIG_REL);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const cfg = parsed as Partial<RedactConfig>;
  if (!cfg || !Array.isArray(cfg.patterns)) return [];
  const out: RegExp[] = [];
  for (const entry of cfg.patterns) {
    if (!entry || typeof entry.pattern !== "string") continue;
    const r = compile(entry);
    if (r) out.push(r);
  }
  return out;
}

/**
 * Merge the built-in redactor with custom rules. Returns a function that
 * applies the built-ins first, then each custom pattern in order, replacing
 * every match with the marker `[redacted]`.
 */
export function makeRedactor(custom: RegExp[]): (s: string) => string {
  return (input: string) => {
    let out = redactSecrets(input);
    for (const re of custom) {
      out = out.replace(re, "[redacted]");
    }
    return out;
  };
}

/** Convenience: load the config and return a ready-to-call redactor. */
export async function loadRedactor(
  projectRoot: string
): Promise<(s: string) => string> {
  return makeRedactor(await loadCustomRules(projectRoot));
}

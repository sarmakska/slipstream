import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the package root. The compiled CLI sits at dist/cli, so the package
 * root is two levels up. The skills and the plugin manifest both live there.
 */
function packageRoot(): string {
  const candidates = [join(here, "..", ".."), join(here, "..", "..", "..")];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "package.json"))) return candidate;
  }
  return candidates[0] as string;
}

/** Resolve the bundled skills directory. */
export function resolveSkillsDir(override?: string): string {
  if (override) return resolve(override);
  return join(packageRoot(), "skills");
}

/**
 * Resolve the plugin root, the directory that holds .claude-plugin, commands and
 * hooks. claudepilot keeps the plugin at the package root so a single tree is
 * both the npm helper and the Claude Code plugin.
 */
export function resolvePluginRoot(override?: string): string {
  if (override) return resolve(override);
  return packageRoot();
}

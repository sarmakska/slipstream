/**
 * Shared text helpers for turning file paths into the concept tokens slipstream
 * tags and clusters on. Observation tagging and lesson distillation both need the
 * same notion of "what concepts does this path name", so it lives here once rather
 * than being copied per module.
 */

/** Path segments that name structure, not a concept, so they add noise to tags. */
const STRUCTURAL = new Set(["src", "lib", "app", "index", "test", "tests", "spec"]);

/**
 * Concept stems from a set of paths: lib/actions/approvals.ts -> [actions,
 * approvals]. Splits every path segment (not just the basename) on case and
 * separators, strips extensions, lowercases, and drops short or structural tokens
 * so "src" and "index" never become a topic.
 */
export function conceptStems(paths: string[]): string[] {
  const out = new Set<string>();
  for (const p of paths) {
    for (const seg of p.split(/[\\/]/)) {
      const stem = seg.replace(/\.[a-z0-9]+$/i, "");
      for (const part of stem.split(/[^a-z0-9]+/i)) {
        const t = part.toLowerCase();
        if (t.length > 2 && !STRUCTURAL.has(t)) out.add(t);
      }
    }
  }
  return [...out];
}

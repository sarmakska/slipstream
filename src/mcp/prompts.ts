/**
 * Expose slipstream's discipline skills as MCP prompts. The MCP spec defines
 * a `prompts/list` and `prompts/get` surface that any client can render in a
 * slash-command picker; turning the SKILL.md files into prompts means every
 * editor with an MCP client surfaces think-before-coding, write-plan,
 * systematic-debugging, scoped-read, context-budget and compact-and-offload
 * without slipstream shipping editor-specific wiring for each.
 *
 * Frontmatter parsing is intentionally tiny: we read the YAML head between
 * the first two `---` lines and pluck `name` and `description`. A full YAML
 * parser is not worth a dependency for two fields. The SKILL.md body
 * (everything after the frontmatter) is the prompt content.
 */
import { readFile, readdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface SkillPrompt {
  name: string;
  description: string;
  /** Absolute path to the SKILL.md file. */
  sourcePath: string;
}

export interface SkillPromptDetail extends SkillPrompt {
  content: string;
}

/**
 * Parse the YAML frontmatter at the head of a SKILL.md. Returns { name,
 * description, body }. Defensive against missing fences or missing keys: the
 * name falls back to the directory stem, the description to an empty string.
 */
export function parseSkillFrontmatter(
  raw: string,
  fallbackName: string
): { name: string; description: string; body: string } {
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return { name: fallbackName, description: "", body: raw };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { name: fallbackName, description: "", body: raw };
  }
  const head = lines.slice(1, end);
  let name = fallbackName;
  let description = "";
  for (const line of head) {
    // Top-level keys only: nested YAML is ignored.
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    const valueRaw = (m[2] ?? "").trim();
    // Strip surrounding quotes if any.
    const value = valueRaw.replace(/^["']|["']$/g, "");
    if (key === "name" && value) name = value;
    else if (key === "description" && value) description = value;
  }
  const body = lines.slice(end + 1).join("\n").trim();
  return { name, description, body };
}

/**
 * Default location of the discipline skills directory, relative to this
 * file's compiled location. Override via env or argument for tests.
 */
export function defaultSkillsRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/mcp/prompts.js -> dist/.. -> skills/context
  return resolve(here, "..", "..", "skills", "context");
}

/** List every SKILL.md in the discipline skills directory, sorted by name. */
export async function listSkillPrompts(skillsRoot?: string): Promise<SkillPrompt[]> {
  const root = skillsRoot ?? defaultSkillsRoot();
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const prompts: SkillPrompt[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sourcePath = join(root, entry.name, "SKILL.md");
    const raw = await readFile(sourcePath, "utf8").catch(() => null);
    if (raw === null) continue;
    const { name, description } = parseSkillFrontmatter(raw, entry.name);
    prompts.push({ name, description, sourcePath });
  }
  prompts.sort((a, b) => a.name.localeCompare(b.name));
  return prompts;
}

/**
 * Load one skill's body by name. Returns null when the name is not in the
 * directory so the MCP handler can answer with a 404-style error.
 */
export async function getSkillPrompt(
  name: string,
  skillsRoot?: string
): Promise<SkillPromptDetail | null> {
  const list = await listSkillPrompts(skillsRoot);
  const match = list.find((p) => p.name === name);
  if (!match) return null;
  const raw = await readFile(match.sourcePath, "utf8");
  const { body } = parseSkillFrontmatter(raw, name);
  return { ...match, content: body };
}

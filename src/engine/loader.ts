import { readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, join, resolve, isAbsolute } from "node:path";
import matter from "gray-matter";
import {
  GATELESS_CATEGORIES,
  REQUIRED_BODY_SECTIONS,
  skillFrontmatterSchema,
  type Skill
} from "./schema.js";

/**
 * A structured problem with a skill file. The validator collects these so a
 * single run reports every fault rather than failing on the first one.
 */
export interface SkillIssue {
  sourcePath: string;
  message: string;
}

export class SkillValidationError extends Error {
  public readonly issues: SkillIssue[];
  constructor(issues: SkillIssue[]) {
    super(
      `${issues.length} skill issue${issues.length === 1 ? "" : "s"} found`
    );
    this.name = "SkillValidationError";
    this.issues = issues;
  }
}

/**
 * Parse and validate a single SKILL.md file. Returns either the loaded skill or
 * the list of issues that stopped it loading. This never throws on a bad
 * skill, it returns the problems, so callers can aggregate.
 */
export function parseSkill(
  raw: string,
  sourcePath: string
): { skill?: Skill; issues: SkillIssue[] } {
  const issues: SkillIssue[] = [];

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (error) {
    return {
      issues: [
        {
          sourcePath,
          message: `frontmatter could not be parsed: ${(error as Error).message}`
        }
      ]
    };
  }

  const result = skillFrontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "(root)";
      issues.push({ sourcePath, message: `${path}: ${issue.message}` });
    }
    return { issues };
  }

  const front = result.data;
  const meta = front.claudepilot;

  // A skill outside the gateless categories must carry a verification gate.
  if (!GATELESS_CATEGORIES.has(meta.category) && !meta.verification) {
    issues.push({
      sourcePath,
      message: `category "${meta.category}" requires a claudepilot.verification gate`
    });
  }

  // The directory name should match the skill name, the Claude Code convention.
  const dirName = basename(dirname(sourcePath));
  if (dirName !== "skills" && dirName !== front.name) {
    issues.push({
      sourcePath,
      message: `skill name "${front.name}" does not match its directory "${dirName}"`
    });
  }

  const body = parsed.content.trim();
  if (body.length === 0) {
    issues.push({ sourcePath, message: "skill body is empty" });
  }

  for (const section of REQUIRED_BODY_SECTIONS) {
    if (!body.includes(section)) {
      issues.push({
        sourcePath,
        message: `body is missing the required "${section}" section`
      });
    }
  }

  if (issues.length > 0) {
    return { issues };
  }

  return {
    skill: {
      name: front.name,
      description: front.description,
      category: meta.category,
      requires: meta.requires,
      verification: meta.verification,
      tags: meta.tags,
      body,
      sourcePath
    },
    issues: []
  };
}

/** Collect every SKILL.md under a directory tree. */
async function collectSkillFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectSkillFiles(full)));
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      out.push(full);
    }
  }
  return out;
}

/**
 * Load every skill under a directory tree. Throws SkillValidationError if any
 * skill is malformed, so the loader can be trusted to only ever return valid,
 * runnable skills.
 */
export async function loadSkills(skillsDir: string): Promise<Skill[]> {
  const root = isAbsolute(skillsDir) ? skillsDir : resolve(skillsDir);
  const dirStat = await stat(root).catch(() => null);
  if (!dirStat || !dirStat.isDirectory()) {
    throw new Error(`skills directory not found: ${root}`);
  }

  const files = await collectSkillFiles(root);
  const skills: Skill[] = [];
  const issues: SkillIssue[] = [];
  const seenNames = new Map<string, string>();

  for (const file of files.sort()) {
    const raw = await readFile(file, "utf8");
    const { skill, issues: fileIssues } = parseSkill(raw, file);
    issues.push(...fileIssues);
    if (skill) {
      const previous = seenNames.get(skill.name);
      if (previous) {
        issues.push({
          sourcePath: file,
          message: `duplicate skill name "${skill.name}" also defined in ${previous}`
        });
      } else {
        seenNames.set(skill.name, file);
        skills.push(skill);
      }
    }
  }

  // Validate that every "requires" reference points at a real skill.
  const names = new Set(skills.map((s) => s.name));
  for (const skill of skills) {
    for (const dep of skill.requires) {
      if (!names.has(dep)) {
        issues.push({
          sourcePath: skill.sourcePath,
          message: `requires unknown skill "${dep}"`
        });
      }
    }
  }

  if (issues.length > 0) {
    throw new SkillValidationError(issues);
  }

  return skills;
}

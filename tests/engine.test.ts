import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadSkills,
  parseSkill,
  SkillValidationError,
  skillFrontmatterSchema
} from "../src/engine/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "fixtures", "skills");

const VALID = `---
name: example-skill
description: A complete example skill in the Claude Code SKILL.md format.
slipstream:
  category: backend
  verification:
    kind: build
    description: builds clean
    command: pnpm build
---

## Steps

Do the work.

## Verify

Run the build.
`;

describe("skill schema", () => {
  it("accepts well formed Claude Code frontmatter with a slipstream block", () => {
    const result = skillFrontmatterSchema.safeParse({
      name: "ok-skill",
      description: "fine",
      slipstream: {
        category: "git",
        verification: { kind: "test", description: "tests pass", command: "pnpm test" }
      }
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown category", () => {
    const result = skillFrontmatterSchema.safeParse({
      name: "ok-skill",
      description: "fine",
      slipstream: {
        category: "marketing",
        verification: { kind: "test", description: "x", command: "y" }
      }
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non kebab name", () => {
    const result = skillFrontmatterSchema.safeParse({
      name: "Bad_Name",
      description: "fine",
      slipstream: { category: "git" }
    });
    expect(result.success).toBe(false);
  });

  it("requires name and description, the fields Claude Code reads", () => {
    const result = skillFrontmatterSchema.safeParse({
      slipstream: { category: "git" }
    });
    expect(result.success).toBe(false);
  });
});

describe("parseSkill", () => {
  it("parses a valid skill", () => {
    const { skill, issues } = parseSkill(VALID, "skills/example-skill/SKILL.md");
    expect(issues).toHaveLength(0);
    expect(skill?.name).toBe("example-skill");
    expect(skill?.verification?.command).toBe("pnpm build");
    expect(skill?.body).toContain("## Steps");
  });

  it("reports a missing required body section", () => {
    const noVerify = VALID.replace("## Verify\n\nRun the build.\n", "");
    const { skill, issues } = parseSkill(noVerify, "skills/x/SKILL.md");
    expect(skill).toBeUndefined();
    expect(issues.some((i) => i.message.includes("## Verify"))).toBe(true);
  });

  it("requires a verification gate for a shipping category", () => {
    const raw = `---
name: no-gate
description: missing verification
slipstream:
  category: git
---

## Steps

x

## Verify

y
`;
    const { skill, issues } = parseSkill(raw, "skills/no-gate/SKILL.md");
    expect(skill).toBeUndefined();
    expect(issues.some((i) => i.message.includes("verification"))).toBe(true);
  });

  it("allows memory and context skills to omit a verification gate", () => {
    const raw = `---
name: memory-add
description: a memory skill needs no build gate
slipstream:
  category: memory
---

## Steps

x

## Verify

y
`;
    const { skill, issues } = parseSkill(raw, "skills/memory-add/SKILL.md");
    expect(issues).toHaveLength(0);
    expect(skill?.category).toBe("memory");
  });
});

describe("loadSkills", () => {
  it("loads the valid fixture directory", async () => {
    const skills = await loadSkills(join(fixtures, "valid"));
    expect(skills).toHaveLength(1);
    expect(skills[0]?.name).toBe("fixture-good");
  });

  it("throws SkillValidationError on the malformed fixture directory", async () => {
    await expect(loadSkills(join(fixtures, "malformed"))).rejects.toBeInstanceOf(
      SkillValidationError
    );
  });

  it("aggregates multiple issues rather than failing on the first", async () => {
    try {
      await loadSkills(join(fixtures, "malformed"));
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SkillValidationError);
      const issues = (error as SkillValidationError).issues;
      expect(issues.length).toBeGreaterThan(1);
    }
  });
});

describe("shipped skill library", () => {
  it("loads every shipped skill cleanly as a valid SKILL.md", async () => {
    const skills = await loadSkills(join(here, "..", "skills"));
    expect(skills.length).toBeGreaterThanOrEqual(40);
    for (const skill of skills) {
      expect(skill.name.length).toBeGreaterThan(0);
      expect(skill.description.length).toBeGreaterThan(0);
      expect(skill.body).toContain("## Verify");
      if (skill.category !== "memory" && skill.category !== "context") {
        expect(skill.verification?.command.length).toBeGreaterThan(0);
      }
    }
  });
});

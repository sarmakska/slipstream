import { z } from "zod";

/**
 * The categories a claudepilot skill can belong to. These map onto the
 * integration surfaces claudepilot targets, plus the cross cutting concerns
 * every production site needs.
 */
export const SKILL_CATEGORIES = [
  "frontend",
  "backend",
  "supabase",
  "cloudflare",
  "vercel",
  "resend",
  "auth",
  "payments",
  "seo",
  "analytics",
  "git",
  "memory",
  "context"
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

/**
 * The verification gate. Every shipping skill MUST declare how to prove the
 * step worked. A skill without an honest check is not a skill claudepilot will
 * trust to continue a flow, because the agent relies on this gate to decide
 * whether it is safe to move on to the next step.
 */
export const verificationKinds = [
  "typecheck",
  "build",
  "test",
  "smoke",
  "healthcheck",
  "command"
] as const;

export const skillVerificationSchema = z.object({
  kind: z.enum(verificationKinds),
  description: z.string().min(1),
  /**
   * The shell command that, on a zero exit code, proves the step succeeded.
   * Required for every kind so the gate is always runnable and never a
   * decorative placeholder.
   */
  command: z.string().min(1),
  /** Optional substring that must appear in stdout for the gate to pass. */
  expect: z.string().optional()
});

export type SkillVerification = z.infer<typeof skillVerificationSchema>;

/**
 * The claudepilot extension block carried in SKILL.md frontmatter under the
 * `claudepilot` key. It holds the category, the verification gate and the
 * dependency list. Keeping it under a namespaced key means the rest of the
 * frontmatter stays a valid Claude Code agent skill: a host that only knows
 * `name` and `description` simply ignores the extra block.
 */
export const claudepilotMetaSchema = z.object({
  category: z.enum(SKILL_CATEGORIES),
  /** Other skill names that should run before this one. */
  requires: z.array(z.string()).default([]),
  /**
   * The verification gate. Required for shipping skills. Memory and context
   * skills are allowed to omit it because they have no build artifact to
   * prove, so the loader only enforces a gate outside those categories.
   */
  verification: skillVerificationSchema.optional(),
  tags: z.array(z.string()).default([])
});

export type ClaudepilotMeta = z.infer<typeof claudepilotMetaSchema>;

/**
 * The Claude Code SKILL.md frontmatter contract. `name` and `description` are
 * the fields Claude Code itself reads to decide when to invoke a skill;
 * `description` is the relevance text. The `claudepilot` block is the
 * namespaced extension this plugin layers on top.
 */
export const skillFrontmatterSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      "skill names must be kebab case, lower case, starting with a letter"
    ),
  description: z.string().min(1).max(1024),
  /** Optional list of tools the skill is allowed to use, Claude Code spec. */
  "allowed-tools": z.array(z.string()).optional(),
  claudepilot: claudepilotMetaSchema
});

export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;

/**
 * A fully loaded skill: validated frontmatter, flattened claudepilot metadata
 * and the Markdown body that carries the runnable instructions for the agent.
 */
export interface Skill {
  /** The skill name, used as its stable id. */
  name: string;
  /** The relevance description Claude Code matches against. */
  description: string;
  category: SkillCategory;
  requires: string[];
  verification?: SkillVerification;
  tags: string[];
  /** The Markdown body, the actual instructions the agent follows. */
  body: string;
  /** Absolute path the skill was loaded from, for diagnostics. */
  sourcePath: string;
}

/**
 * Categories whose skills are about retrieval and memory discipline rather than
 * building a deployable artifact, so the loader does not require a gate.
 */
export const GATELESS_CATEGORIES: ReadonlySet<SkillCategory> = new Set([
  "memory",
  "context"
]);

export const REQUIRED_BODY_SECTIONS = ["## Steps", "## Verify"] as const;

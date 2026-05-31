# Skill engine

The skill engine is the contract and loader behind slipstream's skill library. It lives in `src/engine` and is exercised by the `validate` and `plugin-validate` commands and by the test suite.

## The contract

Every skill is a real Claude Code agent skill: a `SKILL.md` with frontmatter that Claude Code reads. slipstream layers its own metadata under a namespaced `slipstream` key, so a host that only understands `name` and `description` ignores the rest.

```yaml
---
name: cloudflare-d1
description: Use when adding a Cloudflare D1 database. Creates the binding and verifies a migration applies.
slipstream:
  category: cloudflare
  requires:
    - cloudflare-worker
  verification:
    kind: command
    description: A migration applies cleanly.
    command: wrangler d1 migrations apply DB --local
  tags:
    - cloudflare
    - database
---

## Steps
...

## Verify
...
```

The Zod schema in `src/engine/schema.ts` enforces:

- `name`: kebab case, lower case, starting with a letter, up to 64 characters. This is also the skill's stable id and must match its directory name.
- `description`: 1 to 1024 characters. This is the relevance text Claude Code matches against, so it should say when to use the skill.
- `slipstream.category`: one of the known categories.
- `slipstream.verification`: required for every category except `memory` and `context`, which have no build artifact to prove. The gate has a `kind` (`typecheck`, `build`, `test`, `smoke`, `healthcheck` or `command`), a `description`, a runnable `command`, and an optional `expect` substring.
- `slipstream.requires`: optional list of other skill names that should run first.

## The loader

`loadSkills` in `src/engine/loader.ts` walks `skills/**/SKILL.md` and, for each file:

1. Parses the frontmatter with gray-matter and validates it against the schema.
2. Checks the directory name matches the skill `name`.
3. Requires a verification gate outside the gateless categories.
4. Requires the body to contain `## Steps` and `## Verify` sections.
5. After loading all skills, checks every `requires` reference points at a real skill and that no two skills share a name.

It never throws on the first bad skill. It aggregates every issue into a `SkillValidationError`, so one run tells you everything that is wrong.

## Verification gates

A gate is the honest part of a skill. It is the check the agent runs to prove the step worked, rather than assuming it did. A `build` gate runs the build; a `healthcheck` gate curls the deployed URL and, with `expect: "200"`, requires that status in the output. The gate is guidance the agent executes; it does not guarantee correctness beyond what the check measures, and the skills say so.

## Running the validator

```
npx slipstream validate
```

prints the loaded skills and per-category counts, and exits non-zero with a list of issues if anything is malformed. CI runs this on every push and pull request.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/slipstream)

# Contributing to claudepilot

Thanks for wanting to add to claudepilot. The plugin is built to grow to
hundreds of skills, so the contribution path is deliberately simple and the
validator does the policing.

## Setup

```
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm plugin-validate
```

You need Node 20 or newer and pnpm 10.

## Adding a skill

Every skill is a real Claude Code agent skill: a `SKILL.md` in its own
directory, named after the skill.

1. Create `skills/<category>/<skill-name>/SKILL.md`. The directory name must
   match the `name` in the frontmatter.
2. Write the frontmatter. `name` (kebab case) and `description` are the fields
   Claude Code reads; the `description` is the relevance text that decides when
   the skill fires, so make it specific and start it with when to use it. The
   `claudepilot` block carries the category, an optional `requires` list, and a
   verification gate.

   ```yaml
   ---
   name: cloudflare-worker
   description: Use when creating or deploying a Cloudflare Worker. Scaffolds wrangler config and verifies a deploy.
   claudepilot:
     category: cloudflare
     verification:
       kind: build
       description: The worker builds.
       command: wrangler deploy --dry-run
   ---
   ```

3. Write the body with `## Steps` and `## Verify` sections. Both are required.
   Keep steps concrete and the verify section tied to the gate.
4. Every shipping skill must carry a verification gate (`typecheck`, `build`,
   `test`, `smoke`, `healthcheck` or `command`) with a runnable command. Only
   `memory` and `context` skills may omit the gate, because they have no build
   artifact to prove.
5. Run `pnpm build && pnpm plugin-validate`. The validator checks your
   frontmatter, the gate, the body sections and the directory name, and fails on
   anything malformed.

## Conventions

- UK English, no emojis, no em-dashes.
- Keep skills small and single-purpose. A skill that does one thing well is
  easier to recall and to gate.
- If a skill depends on another, list it under `claudepilot.requires` using the
  other skill's `name`.

## Pull requests

Open a focused pull request. CI runs install, lint, build, plugin validation
and tests; all must be green. Update `CHANGELOG.md` under `Unreleased`.

---
Built by Sarma. Part of the SarmaLinux open-source line.
Website: https://sarmalinux.com . GitHub: https://github.com/sarmakska

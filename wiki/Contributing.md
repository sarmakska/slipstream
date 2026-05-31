# Contributing

claudepilot is one repository that is both the published Claude Code plugin and the helper it calls. This page covers building it, the verify gates, and how to add each kind of extension.

## Build and verify

You need Node 20 or newer and pnpm.

```
pnpm install --frozen-lockfile
pnpm build           # tsc to dist/
pnpm lint            # eslint
pnpm test            # vitest, 88 tests
pnpm validate        # the 59 skills load cleanly
pnpm plugin-validate # the whole plugin is well formed
```

All five gates must pass before a change lands. The MCP and doctor tests use `dist/`, so build before test. Commits follow conventional commit style; the history is meant to read as small, logical steps.

## Writing a skill

A skill is a `SKILL.md` under `skills/<category>/<name>/`. The full walkthrough is on [Writing a skill](Writing-a-Skill); the short version:

- frontmatter `name` (kebab-case, matching the directory), `description` (a crisp "Use when ..." trigger), and a `claudepilot` block with `category`, optional `requires`, optional `tags`, and a `verification` gate for any shipping category;
- a body with `## Steps` and `## Verify` sections;
- `pnpm validate` to check it loads.

## Writing an MCP tool

Add a descriptor to `TOOL_DESCRIPTORS` and a case to `callTool` in `src/mcp/tools.ts`. The rule: return the smallest correct thing, and start the description with "Use ...". Wrap the result in `text()` or `err()`; never throw from a tool (the transport catches, but a clean `isError` result is better). Add a case to the MCP test asserting the minimal output.

## Writing a subagent

Add a `<name>.md` under `agents/` with frontmatter `name`, `description` (a "Use when ..." trigger) and `tools`. Prefer the `cp_` MCP tools over `Read` so the agent stays token-disciplined. If the agent should be checked by doctor, add its name to the list in `src/doctor/index.ts` and `src/plugin-validate/index.ts`.

## Adding a hook

Add the script under `hooks/`, wire it in `hooks/hooks.json`, and import the compiled modules from `dist/` (like `session-start.mjs` and `pre-compact.mjs` do) rather than coupling to relative paths. A hook must never throw: swallow every error so it cannot block the session. Add the event to `plugin-validate`'s wanted list if it is required.

## Adding a CLI subcommand

Add a `cmdX` function and a `case` in `main` in `src/cli/index.ts`, and a usage line in `USAGE`. Keep it a thin wrapper over a library function in `src/`, so the logic is testable without the CLI.

## Conventions

- TypeScript, strict, with `noUncheckedIndexedAccess`. ES modules, `.js` import specifiers (NodeNext).
- UK English in prose. No emojis, no em-dashes.
- Comments earn their place: short and dry where they explain a non-obvious choice, absent where the code is plain.
- Real numbers only in docs; run the code and state the machine.

## See also

- [Writing a skill](Writing-a-Skill) for the skill contract in full.
- [Testing strategy](Testing-Strategy) for what a new test should cover.
- [Architecture](Architecture) for where each module lives.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)

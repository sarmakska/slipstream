# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0]

### Added

- Observation memory: memory that builds itself. The `Stop` hook now folds each
  closed turn of the dashboard event log into a compact, durable observation
  under `.claude/slipstream/observations/<session>.jsonl` — summary, files
  touched, tags, a stable project-wide citation id and a local semantic vector.
  Capture is incremental and idempotent via a per-session cursor and runs
  detached so it never blocks the session (`src/memory/observe.ts`).
- Local semantic embedding (`src/memory/embed.ts`): a deterministic, zero-
  dependency hashed term-frequency vector (256 dims, unigram+bigram, camelCase/
  snake_case aware) with cosine similarity, so recall matches by meaning, not
  only exact strings — no native module, no Python, no vector-database process.
- Three-layer progressive memory search (`src/memory/search.ts`) with hybrid
  semantic+lexical ranking, exposed as three new MCP tools and CLI subcommands:
  `sp_search_memory` (compact ranked index), `sp_timeline` (chronological
  context around a hit), `sp_observations` (full detail for filtered ids). The
  layering keeps token cost down until you ask for bodies.
- Dashboard Memory search panel and two API routes (`/api/search`,
  `/api/observation/<id>`), so the observation store is browsable from the live
  dashboard and observations are citable by id.
- Statusline `obs N` segment showing the auto-captured observation count.
- Doctor `observations-dir` check; new `slipstream observe` and
  `slipstream memory search|timeline|observations` helper subcommands.
- 17 new tests (`tests/memory-search.test.ts` plus statusline assertions),
  bringing the suite to 105 across 12 files.

## [0.2.0]

### Added

- Live agent dashboard (pillar five): the `SessionStart` hook auto-starts a
  dependency-light local server bound to `127.0.0.1` on a free port, tails an
  append-only event log under `.claude/slipstream/dashboard/` and serves a
  self-contained live UI over server-sent events with Agents, Discussion,
  Token budget, Plan and Mermaid mind-map panels. Start is idempotent, the
  browser opens behind a setting, sessions replay from the log, the bind is
  local-only with no telemetry, and obvious secrets are redacted before they
  reach disk. New hooks `PostToolUse` and `SubagentStop`; new `slipstream
  dashboard start|emit|replay|sessions` helper subcommands.
- Claude Code plugin packaging: a `.claude-plugin/plugin.json` manifest and a
  `.claude-plugin/marketplace.json` so the plugin installs with
  `/plugin marketplace add sarmakska/slipstream` then `/plugin install slipstream`
  inside Claude Code in VS Code.
- Persistent memory: a structured, file-based store under
  `.claude/slipstream/memory/` with one fact per file (frontmatter `name`,
  `description`, `type`, `tags`) and a regenerated `MEMORY.md` index. Add,
  recall, update and prune memories; recall ranks by relevance description.
- Token efficiency: a compact project map of files, exported symbols and
  purpose; scoped retrieval by symbol (`slice`) and by line range (`lines`); a
  context budget estimate with `ok`, `warn` and `compact` levels.
- Hooks: `SessionStart` loads the memory index and nudges the map,
  `UserPromptSubmit` reminds Claude to recall and read scoped, `PreToolUse`
  warns on large whole-file reads, and `Stop` prompts Claude to persist durable
  facts.
- Guardrailed skill library of 59 Claude Code agent skills (each a `SKILL.md`
  with valid `name` and `description` frontmatter), with a verification gate on
  every shipping skill, across frontend, backend, Supabase, Cloudflare, Vercel,
  Resend, auth, payments, SEO, analytics, git, memory and context.
- Slash commands: `map`, `remember`, `recall`, `forget`, `mindmap`, `status`
  and `validate`.
- Live mind map and status in the chat: `/slipstream:mindmap` renders a themed
  Mermaid diagram (and an optional self-contained HTML artifact) and
  `/slipstream:status` shows the context budget, memory count and mind map.
- A plugin validator (`slipstream plugin-validate`) that checks the manifest,
  the marketplace file, the hooks wiring, the slash commands and every
  `SKILL.md`, run in tests and CI.
- Vitest suite covering the skill engine, the project map and scoped retrieval,
  the memory store, the context budget and the plugin validator.
- Continuous integration running install, lint, build, plugin validation and
  tests on push to main and on every pull request.

[Unreleased]: https://github.com/sarmakska/slipstream/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/sarmakska/slipstream/releases/tag/v0.3.0
[0.2.0]: https://github.com/sarmakska/slipstream/commits/main

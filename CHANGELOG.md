# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Auto-detect plugin vs MCP-only mode at runtime (issue #2). The MCP server now
  decides on its own whether to self-emit dashboard events and auto-start the
  dashboard based on Claude Code signals (`CLAUDE_PLUGIN_ROOT`,
  `CLAUDE_CODE_SESSION`, `.claude/hooks` marker). `SLIPSTREAM_MCP_EMIT` and
  `SLIPSTREAM_DASHBOARD` still override.


## [0.5.1]

### Changed

- Code-review hardening (no behaviour change for users):
  - **Performance on the statusline hot path.** The observation count is now a
    cheap line tally (`countObservations`) instead of fully parsing every
    observation and its 256-float vector; the transcript reader reads only the
    tail (128 KB) instead of the whole file; `budget.json` is written only when
    the true token count actually changes.
  - **Bounded optimization store.** The savings ledger is now a small aggregate
    `savings.json` updated in place, instead of an append-only `savings.jsonl`
    re-parsed in full on every read — bounded size, cheap reads.
  - **De-duplication.** Extracted the advisory lock to `src/util/lock.ts`
    (`withFileLock`, shared by the event log, observation counter and savings) and
    the path→concept-stem helper to `src/util/text.ts` (`conceptStems`, shared by
    observation tagging and lesson distillation); the dashboard budget gauge now
    uses `BYTES_PER_TOKEN` instead of a literal `3.6`.
  - **Robustness.** The dashboard's JSON body reader caps requests at 64 KB.
- CI status, version, tests and node badges added to the README. 1 new test
  (120 total).

## [0.5.0]

### Added

- True context size from the host transcript. Inside Claude Code the statusline
  payload includes `transcript_path`; slipstream now reads the latest `usage`
  block (input + cache read + cache creation + output) to get the real
  context-window occupancy, instead of only estimating from served bytes
  (`src/context/transcript.ts`). The statusline shows it as an exact reading
  (`ctx 47%*`, the `*` marking real vs estimated), and writes it to
  `budget.json` `actualTokens` so the dashboard gauge reads the same true number
  and labels its source `actual` or `estimated`. Editors without a readable
  transcript keep the estimate plus manual `actualTokens` calibration. This works
  for Claude Code anywhere it runs — the CLI, and the Claude Code VS Code
  extension inside Antigravity or VS Code.
- Optimization metric — how much slipstream actually saved you. Every scoped read
  (`sp_symbol`, `sp_lines`) records the bytes it served versus the whole-file
  baseline to an append-only `.claude/slipstream/savings.jsonl`
  (`src/context/savings.ts`). Surfaced as the new `sp_savings` tool and
  `slipstream savings` ("saved ~N tokens, Y% less than whole-file reads"), an
  `opt Y%` statusline segment, and an "optimised" line in the dashboard's Session
  work panel with an `/api/savings` route. Because it is computed from
  slipstream's own tool calls, it is exact in **any** editor — Cursor, Windsurf,
  Antigravity, VS Code — not just Claude Code.
- `slipstream statusline --transcript <path>`; the bundled statusline script
  passes the transcript path automatically. New `sp_savings` MCP tool (15 total).
  5 new tests (119 total).

## [0.4.0]

### Added

- Cross-IDE support: slipstream's value now reaches any MCP editor (Cursor,
  Windsurf, Antigravity, generic VS Code), not only Claude Code, through the one
  component every editor runs — the MCP server.
  - The MCP server self-emits an activity event after each tool call, so the live
    dashboard fills with no lifecycle hooks. Each MCP connection gets a readable
    session id derived from the client. Gated by `SLIPSTREAM_MCP_EMIT` (the plugin
    sets it to `0` because its PostToolUse hook already emits).
  - The MCP server auto-starts the dashboard on connect (detached, idempotent),
    gated by `SLIPSTREAM_DASHBOARD`. New `sp_dashboard` tool returns the URL on
    demand from any editor.
- Token-budget control: an editable `.claude/slipstream/budget.json`
  (`targetTokens`, `warnPct`, `compactPct`, optional `actualTokens`) read by the
  dashboard gauge, the `sp_budget` tool and the statusline alike. The dashboard
  gained a live budget gauge with ok/warn/compact zones, a panel to set the target
  and thresholds, and a "Session work" view (files touched, tool breakdown,
  cumulative tokens). New `/api/budget` (GET/POST) routes.
- Lesson distillation ("continuous learning"): `sp_lessons` and
  `slipstream memory lessons` distil recurring topics from the observation store —
  what a project keeps making you work on, across sessions, with citations — built
  on the v0.3.0 observation memory (`src/memory/lessons.ts`).
- Four adopted workflow skills (original, slipstream-native): `think-before-coding`
  (assumptions, simplicity, surgical changes, goal-driven verification),
  `systematic-debugging` (four-phase root-cause process), `brainstorm-spec`
  (Socratic spec refinement) and `write-plan` (small, verifiable task plans).
  Skill library is now 63.
- 9 new tests (114 total across 13 files) covering budget config, the MCP session
  id and lesson distillation.

### Note

- A true HNSW vector index was evaluated and deferred: at slipstream's store sizes
  brute-force cosine is already sub-10ms, and an index would add complexity against
  the zero-dependency design. Tracked on the roadmap.

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

[Unreleased]: https://github.com/sarmakska/slipstream/compare/v0.5.1...HEAD
[0.5.1]: https://github.com/sarmakska/slipstream/releases/tag/v0.5.1
[0.5.0]: https://github.com/sarmakska/slipstream/releases/tag/v0.5.0
[0.4.0]: https://github.com/sarmakska/slipstream/releases/tag/v0.4.0
[0.3.0]: https://github.com/sarmakska/slipstream/releases/tag/v0.3.0
[0.2.0]: https://github.com/sarmakska/slipstream/commits/main

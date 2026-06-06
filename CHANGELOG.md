# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.26.0] - 2026-06-06

### Added
- **Interactive knowledge graph.** Click any node in the Graph tab to read its detail in a side panel: a file shows the sessions that touched it, a session shows the files it changed, each with how many times. Navigate the memory by clicking through relationships.

## [0.25.0] - 2026-06-06

### Added
- **Project knowledge brief.** Dumps everything slipstream knows about a project into one Markdown document: what it is, how it is organised (the architecture table), what has been built, the durable memory, lessons, instincts and recent work, so someone or a fresh session starting later can pick it up cold. Available as `slipstream brief` on the CLI, a download button on the Overview, and the `/api/brief` endpoint. New `src/dashboard/brief.ts`, three tests.

## [0.24.0] - 2026-06-06

### Added
- **Reproducible token-savings benchmark.** A checked-in script (`scripts/benchmark-token-savings.mjs`, also `pnpm benchmark`) measures whole-file reads versus scoped symbol reads through the project map on real files and emits a Markdown table, so the savings claim is a number anyone can regenerate. The scoped figure averages across every symbol in a file, the honest typical read, and the output states plainly that this is per-read, not end-to-end, efficiency. New `src/map/benchmark.ts`, three tests.

## [0.23.0] - 2026-06-06

### Added
- **Knowledge graph.** A new Graph tab renders files and the sessions that touched them as a node-link diagram: files on an outer ring sized by how often they are touched, sessions on an inner ring, an edge wherever a session changed a file. The bubble map of the project's memory, navigable by relationship rather than by list. New `src/dashboard/graph.ts`, five tests, served by `/api/graph`.

## [0.22.0] - 2026-06-06

### Added
- **`slipstream memory doctor`.** A terminal health check for the memory store mirroring the dashboard health line: total, duplicates, stale and a by-type breakdown, exiting non-zero when the store needs attention so a script can gate on it.

## [0.21.0] - 2026-06-06

### Added
- **Dollar cost of tokens saved.** The scoped-read token savings are now shown as a money figure on the Overview and the Live tab, with the assumed per-million-token rate stated so the number is honest. New `src/context/cost.ts`, five tests, via `/api/savings` and `/api/overview`.
- **Downloadable session report.** A session can be exported as a shareable Markdown document, the said-to-did story plus a summary, from a link on the Flow tab. The honest version of team sharing. New `src/dashboard/report.ts`, two tests, served by `/api/report`.

## [0.20.0] - 2026-06-06

### Fixed
- **The Live band printed prompt text as filenames.** It treated any word containing a dot as a file and read from prompt events, so "files in focus" listed prompt fragments like `v0.8.0`. It now takes files only from tool calls and only when the token is a real path.

### Changed
- **The Overview now opens with a meaningful narration.** Instead of the jargon package description, the hero leads with a sentence built from the code map and activity (file and symbol counts, the largest area and its role, sessions and observations recorded), so the dashboard says something real even before any session has been observed.
- **Cleaner, more premium look.** Panel headings move from tiny uppercase monospace labels to readable sentence-case sans, and cards gain softer shadows, more padding and a larger radius.

## [0.19.0] - 2026-06-06

### Added
- **Memory health.** A health line on the Memory tab reports the store's shape, duplicate clusters and stale entries with a plain verdict, so memory stays small, current and trusted as it grows rather than becoming a dump. New `src/memory/health.ts`, five tests, surfaced via `/api/memory/overview`.

## [0.18.0] - 2026-06-06

### Added
- **Instincts, the self-learning signal.** slipstream notices what recurs across sessions and promotes it to a ranked, confidence-scored instinct: hot files touched repeatedly and topics that keep coming up. Deterministic, no LLM, just counting what keeps happening, so the project gets sharper with every run. Shown on the Memory tab. New `src/memory/instincts.ts`, five tests, served by `/api/instincts`.

## [0.17.0] - 2026-06-06

### Added
- **Conversation search.** Find the exchange where a topic was discussed across the full captured chat, lexical and deterministic with a phrase bonus. The Memory tab search now returns conversation matches alongside observation hits, so "when did we talk about X" is answerable. New `src/memory/conversation-search.ts` and `listConversations`, five tests, served by `/api/search/conversation`.

## [0.16.0] - 2026-06-06

### Added
- **Agents at work, a live presence stage.** Each agent on the Live tab becomes a small animated character whose mood is derived from its latest activity: typing when editing, reading when searching, a pulsing ring when running a command, blinking when thinking, dimmed when waiting. Original CSS characters, no external assets. New `src/dashboard/presence.ts` with six tests, served by `/api/presence`.

## [0.15.0] - 2026-06-06

### Added
- **Message the working agent from the dashboard.** A message outbox: type a note on the Live tab and it is queued locally, then delivered to the agent as context on its next prompt by the UserPromptSubmit hook, drained so each message arrives exactly once. The dashboard cannot interrupt a turn already in progress, which the panel states plainly. New `src/memory/inbox.ts`, served by `/api/message` and `/api/messages`, four tests.

## [0.14.0] - 2026-06-06

### Added
- **Premium web-design skills.** Four original frontend skills that help build sites that look designed rather than defaulted: `frontend-design-system` (one cohesive set of type, spacing, colour and shadow tokens), `frontend-hero-section` (a high-impact landing hero), `frontend-motion` (tasteful entrance and scroll-reveal motion with reduced-motion respected) and `frontend-marketing-sections` (the polished section set below the hero). Each carries a build verification gate. The library is now 75 skills.

## [0.13.0] - 2026-06-06

### Added
- **Where Claude struggled.** A live failures panel on the Live tab surfaces the moments the agent hit an error, a denial or a failed command, pulled from the session observations and the event log and ranked newest first. It sits alongside what Claude is doing and the token budget, so the Live tab is now a real agent-health view. New `src/dashboard/failures.ts`, served by `/api/failures`, six tests.

## [0.12.0] - 2026-06-06

### Added
- **Self-building session summary.** At each turn end the stop hook distils the session into one durable `session-summary` memory, upserted in place, built from the captured conversation and the session's observations. Memory now accrues from what actually happened rather than relying on the agent to call remember, and the next session and the dashboard inherit it. New `src/memory/session-summary.ts`, tested.
- **Session continuity and resume.** A resume brief reconstructs where we left off (the open thread, the files in flight, a suggested next step) from the conversation and observations. The SessionStart hook injects it so Claude resumes warm, and a Resume card on the Overview shows the human the same brief, served by `/api/resume`. New `src/memory/continuity.ts`, tested.

## [0.11.0] - 2026-06-06

### Added
- **Deliberate-engineering skill suite.** Eight new context-discipline skills, original to slipstream, that guide the agent through a deliberate loop rather than ad-hoc edits: `using-slipstream` (recall memory and read the map first, work deliberately, record what is durable), `test-driven-development`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `subagent-driven-development`, `finishing-a-branch` and `writing-skills`. The shipped library is now 71 skills, all loading cleanly through `slipstream validate` and `plugin-validate`.

## [0.10.0] - 2026-06-06

### Added
- **Full conversation capture.** slipstream now records the whole Claude Code conversation, every human ask and the assistant work that followed, not the 200-character prompt stub it kept before. Claude Code hands every hook the transcript path; the stop hook reads it, folds it into exchanges with a deterministic per-exchange summary, and persists a compact record per session under the gitignored store. New `src/memory/transcript.ts` (parser) and `src/memory/conversation.ts` (fold, summarise, persist), ten tests across the two.
- **Conversation tab.** A new tab renders the full recorded chat for a session: each ask in full, the work it produced, the tools used and the reply weight. Served by `/api/conversation`.
- **Real-chat Overview.** The Overview recent-work panel reads the captured conversation when present (real asks and summaries), falling back to the event story otherwise.

### Changed
- The reading surfaces of the dashboard (hero, insight paragraphs, flow and conversation text, area roles, lessons) now render in a clean sans-serif while labels, numbers and code stay monospace, for a more legible, finished feel.

## [0.9.0] - 2026-06-06

### Added
- **Overview landing.** The dashboard now opens on an Overview that answers, in plain English, what the project is (identity read from package.json), how it is organised (a human-readable architecture summary derived from the live code map, each area labelled with its role), what has been built (the observation summary) and the most recent work. New `src/dashboard/overview.ts` is pure over the map with tests; a `/api/overview` route assembles the picture.
- **Flow tab, the said-to-did map.** A new tab reads a session back as a story: each lane opens with what you said and lists what the agent did about it, the files touched and a one-line summary. New `src/dashboard/story.ts` folds the event log into lanes, pure with tests, served by `/api/story`.
- **Memory-that-survives surface.** The Memory tab now leads with the context the next session reloads after a lost or compacted session: a summary of what has been built, the per-session compaction digests, the durable facts promoted via `sp_remember` and the lessons distilled across sessions. Served by `/api/memory/overview`.
- **Auto-open on every session start.** The session-start hook opens the dashboard whenever a session begins, not only the first time the server starts. Honours `autoOpen` and `SLIPSTREAM_DASHBOARD_OPEN=0`.

## [0.8.0] - 2026-06-06

### Added
- **Dashboard insights band.** Every data tab now opens with a natural-language band: one paragraph plus three to five bullets that describe the view rather than only tabulate it. The **Live** band names the session, tool count, optimisation percentage, files in focus and the near-term step runway, and flags the budget level. The **Project** band names the dominant focus directory, drift flags to review, the memory accumulation rate and the optimisation total. The **Journal** band summarises one day: observation and session counts, the files activity concentrated on and the peak activity window. The **Sessions** band ranks sessions and calls out the unusually heavy and quiet ones. Every sentence is generated deterministically from the existing observation store with no LLM and no new persistence, so the prose is reproducible and traceable to a single source query.
- New `src/dashboard/insights.ts` with five pure generators (`liveInsights`, `projectInsights`, `journalInsights`, `sessionsInsights`, `driftStories`) plus `rankSessions`, and four `/api/insights/{live,project,journal,sessions}` routes. Eighteen tests pin every template branch.

## [0.7.2] - 2026-06-05

### Fixed
- **Observation memory in MCP-only editors (#10).** `foldObservations` gains an opt-in `flushOpen` option that materialises the trailing open turn when no closing `stop` event arrives. The four memory-reading tools (`sp_search_memory`, `sp_timeline`, `sp_observations`, `sp_lessons`) now call `captureObservations({ flushOpen: true })` against every session when the runtime is `mcp-only`, so Cursor, Windsurf and Antigravity finally get a populated memory the moment they query it. Hook-fed Claude Code continues to materialise only at `stop` boundaries, so turns are not prematurely split.
- **Doctor `duplicate-registration` false-positive (#13).** The check used to compare static file presence; in legitimate hybrid setups (manual hooks via `.claude/settings.json` plus `.mcp.json`) it fired without the plugin being loaded. It now keys off the detected runtime: a FAIL only fires when the Claude Code plugin is actually active alongside a project `.mcp.json` that also registers slipstream.

## [0.7.1] - 2026-06-05

### Fixed
- **Windows hook telemetry (#9).** `emit()` previously spawned a detached child to write the event, then exited; the child was torn down before the write completed and every hook event was silently lost. `emit()` now writes in-process and every hook awaits it. Also faster: no node cold-start per hook.
- **Observation memory builds in-process (#10, Claude Code half).** `stop` now folds the turn in-process via `captureObservations` instead of a detached `observe` spawn, so the observation store actually populates. The remaining MCP-only-editor half of #10 stays open.
- **Dist imports on Windows.** Dynamic `import(absolutePath)` was parsed as a `c:` URL scheme on Windows and threw. All dist dynamic imports now route through `pathToFileURL`.
- **Server version (#11).** `serverInfo.version` on the MCP initialize handshake was a hardcoded literal (lagging at 0.5.1). It now reads from `package.json` at module load with a regression test asserting the two stay in lockstep.

### Removed
- The retired `describe.skip` `sp_digest` block in `tests/mcp.test.ts` (already gone in 0.6.x; cleaned up the leftover stub).

## [0.7.0] - 2026-06-04

### Added
- Dashboard tabbed navigation: Live, Project, Journal, Sessions and Memory.
- **Project tab**: six project-wide KPIs (sessions, observations, unique files, opt %, memories, drift), a 365-day GitHub-style activity heatmap with click-to-day navigation, a file leaderboard with violet-gradient bars, an inline SVG donut chart for observations-by-kind, and a distilled lessons grid.
- **Journal tab**: per-day digest with six tiles (observations, sessions, files, drift, tools, skills), top files for the day, tools used as colour-coded pills, sessions list, plus prev/today/next date navigation.
- **Sessions tab**: project-wide sessions table with open and delete actions; destructive delete is gated behind a confirmation modal.
- **Memory tab**: full-project search expanded with kind filter chips (edit, plan, decision, search, map, error, run) and colour-coded result badges.
- New API endpoints: `/api/project/summary`, `/api/project/heatmap`, `/api/project/files`, `/api/project/lessons`, `/api/project/day`, `DELETE /api/sessions/:id`.
- Header gains a Refresh button that re-pulls the active tab's data; toast notifications confirm actions.

## [0.6.1] - 2026-06-04

### Added
- Dashboard `/api/health` endpoint with version, pid and startedAt (#6).
- Version-aware restart in `startDashboard`: a stale dashboard from a previous build is killed and replaced when the recorded version no longer matches the installed package (#6).
- Stable URL file at `<project>/.claude/slipstream/dashboard.url` after every dashboard start, so callers can locate the live URL (#6).
- Doctor checks: `duplicate-registration` flags slipstream wired via both the plugin and `.mcp.json`; `double-emit` flags `SLIPSTREAM_MCP_EMIT=1` set on top of active hooks; `stale-dashboard` flags a running dashboard whose version is behind the installed package (#4).
- Doctor fix lines for `mcp-build`, `duplicate-registration`, `double-emit`, `stale-dashboard` (#4).

### Fixed
- Lint failure left over from the sp_digest rebase: unused imports in `tests/mcp.test.ts`.

## [0.6.0] - 2026-06-04

### Added

- Map watcher: `--watch-map` flag on `slipstream observe` and `slipstream dashboard start` re-reads the project map on disk changes with a 500ms debounce.
- Token forecast: new `forecastTokens(history)` in `src/budget/forecast.ts`, surfaced as `forecast.stepsUntilCompact` on the dashboard JSON and as an optional `(~N steps)` suffix on the statusline when the budget is engaged.
- Replay export: `slipstream export <sessionId> --out replay.zip` bundles the session transcript, reduced state, observations and a project map snapshot with a `manifest.json` describing each entry.
- Configurable redaction: optional `.claude/slipstream/redact.json` adds project-specific regex patterns to the built-in secret redactor; invalid files are ignored silently.
- Doctor one-line fixes: failed `slipstream doctor` checks now print a one-line remedy, covering `.claude/` dir, MCP declaration, memory dir, dashboard port and dashboard socket.
- Hook latency budget guard: every hook handler is wrapped in `withLatencyGuard`; handlers exceeding `SLIPSTREAM_HOOK_BUDGET_MS` (default 200) log a warning to stderr without throwing.
- Per-skill stats: observations now record the active skill; `slipstream stats --by-skill` prints a table of calls, average opt% and total tokens, and the same data is served on the dashboard at `/api/stats/by-skill`.
- CI mode: `slipstream observe --ci` emits one JSON line per captured observation to stdout and exits without booting the dashboard or opening a socket.
- Drift detection: a new keyed observation whose `claim` contradicts the recent history is flagged with `drift: true` and rendered with a `[DRIFT]` marker in `sp_observations`.

### Deferred to a later sprint

Skill marketplace, ONNX MiniLM embedding upgrade, inline memory editor in the dashboard, dashboard auth for tunnelled access, JetBrains plugin (native), cross-session anomaly detection.

## [Unreleased]

### Added

- Discipline skills exposed as MCP prompts (issue #7). The MCP server now
  implements `prompts/list` and `prompts/get`, surfacing think-before-coding,
  write-plan, systematic-debugging, scoped-read, context-budget and
  compact-and-offload as slash-command prompts in any MCP client. The
  `sp_budget` tool also accepts an `actualTokens` parameter for hosts without
  a readable transcript.
- `slipstream-setup` editor-aware bin (issue #5). One idempotent command wires
  slipstream into Claude Code (`.claude/settings.local.json`) or any of
  Cursor, Windsurf, Antigravity and VS Code (`<editor>/mcp.json`). Detects the
  editor when run with `--editor=auto`, refuses to double-wire if both
  plugin-mode hooks and a standalone `.mcp.json` slipstream entry are
  present, and supports `--dry-run` to preview the diff before writing.
- MCP-side compaction tools `sp_digest` and `sp_resume` (issue #3). Editors
  without a PreCompact hook can now write a session digest on demand and
  rehydrate it on the next session. The `sp_budget` tool gains a
  `recommendation` hint at warn and compact thresholds and accepts an
  `actualTokens` parameter to override the bytes-based estimate when the host
  exposes a true token count.
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

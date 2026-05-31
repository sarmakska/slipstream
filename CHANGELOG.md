# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Live agent dashboard (pillar five): the `SessionStart` hook auto-starts a
  dependency-light local server bound to `127.0.0.1` on a free port, tails an
  append-only event log under `.claude/claudepilot/dashboard/` and serves a
  self-contained live UI over server-sent events with Agents, Discussion,
  Token budget, Plan and Mermaid mind-map panels. Start is idempotent, the
  browser opens behind a setting, sessions replay from the log, the bind is
  local-only with no telemetry, and obvious secrets are redacted before they
  reach disk. New hooks `PostToolUse` and `SubagentStop`; new `claudepilot
  dashboard start|emit|replay|sessions` helper subcommands.
- Claude Code plugin packaging: a `.claude-plugin/plugin.json` manifest and a
  `.claude-plugin/marketplace.json` so the plugin installs with
  `/plugin marketplace add sarmakska/claudepilot` then `/plugin install claudepilot`
  inside Claude Code in VS Code.
- Persistent memory: a structured, file-based store under
  `.claude/claudepilot/memory/` with one fact per file (frontmatter `name`,
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
- Live mind map and status in the chat: `/claudepilot:mindmap` renders a themed
  Mermaid diagram (and an optional self-contained HTML artifact) and
  `/claudepilot:status` shows the context budget, memory count and mind map.
- A plugin validator (`claudepilot plugin-validate`) that checks the manifest,
  the marketplace file, the hooks wiring, the slash commands and every
  `SKILL.md`, run in tests and CI.
- Vitest suite covering the skill engine, the project map and scoped retrieval,
  the memory store, the context budget and the plugin validator.
- Continuous integration running install, lint, build, plugin validation and
  tests on push to main and on every pull request.

[Unreleased]: https://github.com/sarmakska/claudepilot/commits/main

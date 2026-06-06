<h1 align="center">slipstream by sarmalinux</h1>

<p align="center">The local memory and observability layer for Claude Code. Claude remembers across sessions, reads far fewer tokens, and you can see everything it did.</p>

<p align="center"><em>slipstream is not affiliated with or endorsed by Anthropic. Claude and Claude Code are trademarks of Anthropic, referenced here only to describe compatibility.</em></p>

<p align="center">
<a href="https://github.com/sarmakska/slipstream/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sarmakska/slipstream/actions/workflows/ci.yml/badge.svg"></a>
<a href="https://github.com/sarmakska/slipstream/releases"><img alt="Version" src="https://img.shields.io/github/package-json/v/sarmakska/slipstream"></a>
<img alt="Tests" src="https://img.shields.io/badge/tests-320%20passing-brightgreen">
<img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20-brightgreen">
<a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/github/license/sarmakska/slipstream"></a>
</p>

A long Claude Code session dies one of two ways: it reads whole files until the context window is full and forgets the start of its own plan, or it does good work and then the session ends and every decision evaporates. slipstream stops both, and lets you watch what the agent did while it did it. It installs as a Claude Code plugin and also runs as an MCP server inside Cursor, Windsurf, Antigravity, VS Code and JetBrains. Everything is local, gitignored, and never leaves your machine.

## What you actually get

- **Claude remembers across sessions.** Every turn is folded into a local observation; each session is distilled into a durable summary automatically, no `remember` call needed. The next session starts knowing what the last one did.
- **Cold start is never cold.** On every session start slipstream injects a freshly built knowledge feed: what the project is, how it is organised, the most-connected files to read first, what was recently asked, and what is remembered. Claude opens oriented instead of blank.
- **~95% fewer tokens per read, and it is reproducible.** Instead of opening whole files, Claude pulls one symbol or one line range through the scoped map. `pnpm benchmark` measures it on real files and prints a table you can regenerate. This is per-read efficiency, not end-to-end; the script says so plainly.
- **Multiple tabs coordinate.** Open several Claude Code sessions on one project and each posts what it is working on to a shared local bus; every session sees the others at its next turn and builds on their work instead of duplicating it. This is turn-boundary coordination, not live mid-turn messaging, which the platform does not allow.
- **A local dashboard that shows the real work.** Nine views on `127.0.0.1`, fed by your actual sessions: what was said and done, the full conversation, where Claude struggled, token and dollar savings, distilled lessons, recurring instincts, and an interactive code-dependency graph.
- **Skills that make Claude work deliberately.** 75 shipped skills, including a methodology set (`using-slipstream`, `test-driven-development`, `verification-before-completion`, code review, `finishing-a-branch`) and a premium web-design track.

## Install

As a Claude Code plugin, the hooks, MCP server, skills, statusline and dashboard all wire up automatically:

```
/plugin install slipstream
```

In Cursor, Windsurf, Antigravity, VS Code or JetBrains (MCP only), one idempotent command writes the editor's MCP config:

```
npx slipstream-setup --editor=cursor
```

After install, just use Claude Code normally. slipstream captures each session, starts the dashboard, and prints its local URL in chat.

## The dashboard

Nine views, grouped Now / History / Knowledge, all on real captured data:

- **Overview** — a plain-English narration of what the project is and how it is organised, key stats, and a downloadable full project brief.
- **Live activity** — what Claude is doing now, animated agent presence, where it struggled, and the token budget.
- **Said & done** — each thing you asked and the work it produced, with a per-exchange summary and a downloadable report.
- **Full conversation** — the complete recorded chat for a session.
- **Daily journal** — a per-day summary: observations, files, tools and sessions.
- **Sessions** — every session; click one for its full detail.
- **Project stats**, **Memory** (summary, health, durable facts, instincts, lessons, search) and two graphs: a **memory graph** and an interactive **code map** (files as nodes, imports as edges, god nodes ringed).

## How Claude uses it

Three lifecycle hooks do the work, automatically, for an installed user:

- **SessionStart** injects the knowledge feed, the resume brief (where you left off), recalled durable memories, and what other open tabs are doing.
- **PreToolUse / PostToolUse** record activity and tally scoped-read savings.
- **Stop** folds the turn into observations, distils a session summary, ingests the full conversation from the transcript, and posts this session's status to the shared bus.

The `sp_*` MCP tools (`sp_map`, `sp_symbol`, `sp_lines`, `sp_search`) are how Claude reads scoped instead of whole-file. `slipstream brief` and `slipstream graph` expose the same knowledge on the CLI.

## Honest limits

- **No live cross-chat.** Separate Claude Code tabs cannot message each other mid-turn; the platform has no inbound channel. slipstream coordinates them at turn boundaries through shared memory, not in real time.
- **Per-read, not end-to-end savings.** The ~95% figure is the cost of one scoped read versus the whole file. Real session savings depend on how often the agent re-reads.
- **Capture is going forward.** slipstream records sessions from when it is installed; it does not reconstruct history that happened before it.

## Quality

320 tests, lint clean, plugin-validate clean, CI green on every release. Local-only, no telemetry, no account, MIT.

```
pnpm test          # the suite
pnpm benchmark     # reproduce the token-savings table
pnpm build         # server + dashboard
```

## License

MIT. Built by [Sarma](https://sarmalinux.com).

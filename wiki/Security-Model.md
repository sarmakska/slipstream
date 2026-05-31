# Security model

claudepilot runs entirely on your machine. There is no account, no telemetry, no remote service. This page is honest about what that means and what it does not.

## What runs and where

- The **helper** and the **MCP server** are local Node processes Claude Code spawns. They read your project and write under `.claude/claudepilot/`. They make no network calls.
- The **dashboard server** binds `127.0.0.1` on a free port (`src/dashboard/server.ts`). It is reachable only from your machine. There is no `0.0.0.0` bind and no auth, because the threat model is a local-only loopback service, not an exposed one. If you forward the port or run in a shared environment, that assumption changes; do not.

## Secret redaction

The dashboard activity stream can carry tool inputs, and a tool input can contain a token or a connection string. Even though the stream is local, you might screen-share the dashboard, so claudepilot redacts before an event ever reaches disk (`redactSecrets` in `src/dashboard/events.ts`). The patterns it masks:

- Bearer tokens and authorization headers.
- Common provider key prefixes: `sk_`, `pk_`, `rk_`, `ghp_`, `github_pat_`, `xoxb`, and others.
- AWS access key ids (`AKIA...`).
- `KEY=`, `TOKEN=`, `SECRET=`, `PASSWORD=` style assignments.
- Connection strings with inline credentials (`scheme://user:pass@host`).

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#0d1117','primaryTextColor':'#f5f7fa','primaryBorderColor':'#38bdf8','lineColor':'#22d3ee','fontFamily':'monospace'}}}%%
flowchart LR
  Hook[hook reads tool input] --> Make[makeEvent]
  Make --> Redact[redactSecrets + redactData]
  Redact --> Disk[(append-only log)]
  Disk --> UI[dashboard]
```

`makeEvent` is the only way to construct an event, and it always redacts, so a caller cannot accidentally skip it. **This is blunt by design.** It masks things that are not secrets before it lets a real one through, which is the safe direction. Do not treat it as a vault; it is a screen-share guard.

## What claudepilot never does

- It never sends your code, prompts or memories anywhere. If it phoned home it would not be claudepilot.
- It never executes a skill's verification command for you; the agent runs gates, and you see them.
- The `PreCompact` digest and the memory store are written under your project only. Add `.claude/claudepilot/` to `.gitignore` to keep them off the remote, or commit `memory/` deliberately if you want to share durable facts with your team.

## cp-reviewer's secret scan

The `cp-reviewer` subagent ([Subagents](Subagents)) greps the diff for the same leak shapes before a push and fails the review if it finds one committed to the tree. That is a pre-push guardrail, not a substitute for a real secret scanner in CI.

## Supabase RLS

The `cp-schema` subagent and the `supabase-rls` skill default to deny: a table with RLS enabled and no policy denies all access. That is the safe starting point claudepilot encourages for any table holding user data.

## See also

- [Live agent dashboard](Live-Agent-Dashboard) for the local-only server.
- [Data formats](Data-Formats) for the redacted event shape.
- [Subagents](Subagents) for cp-reviewer's scan.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)

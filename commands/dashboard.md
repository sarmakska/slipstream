---
description: Open or replay the live local agent dashboard for this session.
argument-hint: "[start|replay|sessions]"
---

The live agent dashboard auto-starts at session start, but this command opens it on demand, prints the URL again, or replays a past session. Everything stays on the machine; the server binds 127.0.0.1 only and there is no telemetry.

## Steps

1. To start (or reuse) the dashboard and print its localhost URL, run `npx slipstream dashboard start .`. Start is idempotent, so this reuses a running server rather than spawning another.
2. Share the printed `http://127.0.0.1:<port>` URL so it can be opened in a browser. The Agents, Discussion, Token budget, Plan and Mind-map panels stream live over server-sent events.
3. To list recorded sessions, run `npx slipstream dashboard sessions .`. To replay one, run `npx slipstream dashboard replay . --session <id>` and report the reconstructed agent count, statuses and approximate tokens.
4. If the browser did not open, the URL in the chat is the fallback. To disable auto-open, set `autoOpen` to false in `.claude/slipstream/dashboard.json` or export `SLIPSTREAM_DASHBOARD_OPEN=0`.

## Verify

Confirm the command prints a `127.0.0.1` URL and that fetching it returns the dashboard page, or that a replay reports the agent state reconstructed from the log.

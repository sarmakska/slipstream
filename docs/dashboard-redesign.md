# Dashboard redesign — design spec

Status: approved, in build
Date: 2026-06-16
Branch: `feat/dashboard-redesign`

## Problem

The local dashboard is hard to read and does not reflect reality.

1. **Liveness is wrong.** The Agents view reads the cross-tab bus, and the bus is
   written by a single hook — `stop.mjs` — which only fires when a turn *ends*.
   While an agent is actually working (mid-turn), the view is empty or stale, and
   entries decay after ten minutes. So an agent doing work shows nothing.
2. **Sessions are an unreadable dump.** Each session renders every prompt plus up
   to twelve tool actions per lane. There is no synthesis, so the page is a wall
   of text nobody reads.
3. **Two dashboards drift apart.** A React app (`web/`) and a legacy inline HTML
   page (`src/dashboard/ui.ts`) both exist. The server picks one based on whether
   the web bundle is built. Maintaining two UIs guarantees confusion.
4. **Rich data is captured but never shown.** The `resume` endpoint (open thread,
   suggested next, files in flight) and `instincts` / `lessons` are served by the
   API but barely surface in the UI.

## Goals

- The dashboard shows live work the instant it starts, truthfully.
- A reader understands a session in one paragraph, and can drill in if they want.
- One dashboard, one design language.
- Surface what is already captured: do-next, what was learned.

Non-goal for this spec: LSP-backed scoped reads. That is a separate backend
effort tracked on its own.

## Architecture

### Liveness (the core fix)

Move bus writes off the turn boundary.

- Post a bus heartbeat at **turn start** (`user-prompt-submit.mjs`) carrying the
  session's open thread and files in flight, and refresh it on `post-tool-use`.
- Keep the `stop.mjs` write as the closing snapshot.
- `active` is derived from recency (seen in the last N minutes), so an agent
  appears immediately and fades when genuinely idle.
- The Pulse live strip reads the presence event stream (already emitted per tool
  call by `post-tool-use`) for the moving "what it is doing right now" line.

### Information architecture — four views

- **Pulse** (home): identity and headline stats; the **Do-Next** card from the
  `resume` endpoint (open thread, suggested next, files in flight); a live strip
  of agents at work; recent work; token and dollar savings.
- **Sessions**: digest-first. One synthesized paragraph per session, grouped by
  day. Expand a session into a tight timeline — what was asked, what was done —
  not every raw action.
- **Memory**: durable facts plus a Hindsight panel that elevates instincts and
  lessons into "what has been learned".
- **Map**: the code dependency graph.

Live, Office, Journal, Project and Conversation collapse into Pulse and Sessions.
The legacy `ui.ts` dashboard is removed; the server keeps a small stub that asks
the user to build the web bundle, so there is exactly one real UI.

### Design language — Slipstream Flow

Keep the dark palette. Add a signature: a flowing-current motif in the header,
glass cards, a live heartbeat dot, tabular-figure hero numbers with a count-up.
Readability first — synthesis and hierarchy over rows of raw text.

## Data flow

No new data sources are required for the dashboard views; every view maps to an
endpoint the server already serves (`overview`, `resume`, `presence`, `agents`,
`story`, `conversation`, `memory`, `instincts`, `codegraph`). The session digest
paragraph is synthesized server-side from the existing story and conversation so
the client stays thin. The only new write path is the bus heartbeat at turn
start and on tool use.

## Error handling

Every view degrades to a calm empty state when its endpoint returns nothing.
Liveness polling fails silent and retries; a stale bus entry renders as idle
rather than disappearing.

## Testing

- Pure helpers (digest synthesis, recency-based `active`, presence mood) are unit
  tested, matching the existing test style.
- The heartbeat write path is covered by a hook test asserting the bus gains an
  entry at turn start, not only at stop.
- Manual gate: run the build, open the dashboard, start a task in another tab,
  confirm the agent appears live and a session reads as one paragraph.

## Sequencing

- Phase A: liveness fix, Pulse, Sessions digest.
- Phase B: Memory/Hindsight, Map, retire legacy, flow visuals.

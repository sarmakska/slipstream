# Roadmap and limitations

Real projects say what they are not. This page is the honest version.

## Limitations

- **The token budget is an estimate, not the real counter.** slipstream cannot read Claude Code's internal token meter, so it counts bytes pulled into context and converts at a cautious 3.6 bytes per token (`src/context/budget.ts`). It is tuned to warn early. Treat the percentages as a strong hint, not gospel.
- **The dashboard observes; it does not control.** It cannot pause a tool call, cancel a subagent or steer the plan. That is by design: it is an observability surface.
- **Subagent visibility depends on what Claude Code exposes.** There is a reliable `SubagentStop`, so the dashboard infers a subagent from the first event that names it and flips its status on stop. There is no `SubagentStart` event today; if Claude Code adds one, it gets wired.
- **The map is heuristic.** A line scan, not a parser. A slice can occasionally return the wrong span; fall back to a line range (`npx slipstream lines . <file> <start> <end>`).
- **Secret redaction is blunt.** Pattern-based, biased to over-mask. It will hide things that are not secrets before it lets a real one through. Do not treat it as a vault.
- **The skill library targets the stack I ship on:** Cloudflare, Supabase, Vercel, Resend. It is not a universal scaffolder for every framework.

## Non-goals

- No hosted or cloud version. slipstream stays local-only on purpose.
- No accounts, no telemetry, no phone-home. If it sends data off the machine, it is not slipstream.
- Not a replacement for your judgement. The helper owns the objective parts (indexing, retrieval, budget, recording, validation); deciding what to remember and when to compact stays with you and the agent.

## Shipped since the first release

- The bundled MCP server (`sp_map`, `sp_symbol`, `sp_lines`, `sp_search`, `sp_remember`/`sp_recall`/`sp_forget`, `sp_budget`, `sp_mindmap`), so Claude works through precise tools. See [MCP tools](MCP-Tools).
- Lossless compaction via a `PreCompact` digest reloaded at session start. See [Lossless compaction](Lossless-Compaction).
- Signal-ranked memory recall, not load-everything. See [Memory recall](Memory-Recall).
- Three shipped subagents (sp-shipper, sp-schema, sp-reviewer). See [Subagents](Subagents).
- A context-budget statusline and a terse output style. See [Statusline](Statusline) and [Output style](Output-Style).
- `/slipstream:doctor`, an end-to-end install check.

## Roadmap

What I intend to add next, roughly in order:

- A compaction timeline on the dashboard, marking where a session was digested and reloaded.
- An optional per-agent diff view in the activity stream.
- Export of a session log as a shareable, self-contained HTML artifact, the same shape as the existing mind-map artifact.
- Per-model context windows for the budget, so the bar matches the model in use.
- A real `SubagentStart` event if Claude Code exposes one, for cleaner subagent timelines.

What I will not add: anything that breaks the local-only promise, an MCP SDK dependency while the hand-rolled server suffices, and anything that turns the observability dashboard into a control plane.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/slipstream)

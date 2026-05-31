# Roadmap and limitations

Real projects say what they are not. This page is the honest version.

## Limitations

- **The token budget is an estimate, not the real counter.** claudepilot cannot read Claude Code's internal token meter, so it counts bytes pulled into context and converts at a cautious 3.6 bytes per token (`src/context/budget.ts`). It is tuned to warn early. Treat the percentages as a strong hint, not gospel.
- **The dashboard observes; it does not control.** It cannot pause a tool call, cancel a subagent or steer the plan. That is by design: it is an observability surface.
- **Subagent visibility depends on what Claude Code exposes.** There is a reliable `SubagentStop`, so the dashboard infers a subagent from the first event that names it and flips its status on stop. There is no `SubagentStart` event today; if Claude Code adds one, it gets wired.
- **The map is heuristic.** A line scan, not a parser. A slice can occasionally return the wrong span; fall back to a line range (`npx claudepilot lines . <file> <start> <end>`).
- **Secret redaction is blunt.** Pattern-based, biased to over-mask. It will hide things that are not secrets before it lets a real one through. Do not treat it as a vault.
- **The skill library targets the stack I ship on:** Cloudflare, Supabase, Vercel, Resend. It is not a universal scaffolder for every framework.

## Non-goals

- No hosted or cloud version. claudepilot stays local-only on purpose.
- No accounts, no telemetry, no phone-home. If it sends data off the machine, it is not claudepilot.
- Not a replacement for your judgement. The helper owns the objective parts (indexing, retrieval, budget, recording, validation); deciding what to remember and when to compact stays with you and the agent.

## Roadmap

What I intend to add, roughly in order:

- A compaction timeline on the dashboard, so you can see where a session was summarised and offloaded.
- An optional per-agent diff view in the activity stream.
- Export of a session log as a shareable, self-contained HTML artifact, the same shape as the existing mind-map artifact.
- Per-model context windows for the budget, so the bar matches the model in use.

What I will not add: anything that breaks the local-only promise, and anything that turns the observability dashboard into a control plane.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)

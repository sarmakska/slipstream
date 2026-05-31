---
description: Save a durable fact to claudepilot persistent memory so it survives future sessions.
argument-hint: "[what to remember]"
---

Persist a durable fact about this project to claudepilot memory. Use this for decisions, conventions, architecture notes, gotchas and where credentials live, so the next session and the next compaction do not lose it.

Subject: $ARGUMENTS

## Steps

1. Decide the memory type: one of `decision`, `convention`, `architecture`, `gotcha`, `credential-location`, `todo`, `fact`.
2. Write a one-line `description` that is good recall text (what question would make this memory relevant), and a clear Markdown `body` with the fact itself.
3. Run `npx claudepilot memory add --type <type> --desc "<description>" --body "<body>" --tags "<comma,tags>" --root .`. The helper writes one file per fact under `.claude/claudepilot/memory/` and regenerates `MEMORY.md`.

## Verify

Run `npx claudepilot memory list --root .` and confirm the new memory appears with the right type and description.

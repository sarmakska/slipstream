---
name: compact-and-offload
description: Use when the context budget is near full (level compact) or before a planned compaction, to summarise the session and offload durable facts to claudepilot memory so nothing important is lost when context is trimmed.
claudepilot:
  category: context
  requires:
    - memory-capture
    - context-budget
  tags:
    - tokens
    - compaction
---

## Overview

Compaction trims the conversation to free context. Anything not written down is lost. This skill makes compaction safe: it pushes durable knowledge into persistent memory first, so the next stretch of work resumes from the index rather than re-reading the codebase.

## Steps

1. Review the session for durable outcomes: decisions made, conventions agreed, architecture learned, gotchas hit, and any open todos.
2. For each, run `memory-capture` so it lands in `.claude/claudepilot/memory/` and the `MEMORY.md` index.
3. Write a short plain-language summary of where the work stands and what is next, then compact. After compaction, the SessionStart hook reloads the memory index, and you re-read the project map rather than the old transcript.

## Verify

Run `npx claudepilot memory list --root .` and confirm the durable facts from this session are stored before you compact.

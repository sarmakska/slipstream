---
name: memory-prune
description: Use when a stored memory has become wrong or obsolete, to remove it from slipstream persistent memory so it stops misleading future sessions. A wrong durable fact is worse than no fact.
slipstream:
  category: memory
  requires:
    - memory-capture
  tags:
    - memory
    - hygiene
---

## Overview

Memory hygiene matters: an out-of-date decision that keeps resurfacing will steer the agent wrong. This skill removes a memory cleanly and refreshes the index.

## Steps

1. Run `npx slipstream memory list --root .` to find the exact memory name.
2. Confirm the fact is genuinely obsolete, not just temporarily inconvenient. If it changed rather than disappeared, prefer updating it with `memory-capture`.
3. Run `npx slipstream memory prune <name> --root .`. The helper deletes the file and regenerates `MEMORY.md`.

## Verify

Run `npx slipstream memory list --root .` again and confirm the memory is gone and the index no longer lists it.

---
description: Prune a stale or wrong memory from claudepilot persistent memory.
argument-hint: "[memory name]"
---

Remove a memory that is no longer true so it stops misleading future sessions. Keeping memory clean is part of the discipline: a wrong durable fact is worse than no fact.

Memory to prune: $ARGUMENTS

## Steps

1. Run `npx claudepilot memory list --root .` to find the exact memory name.
2. Run `npx claudepilot memory prune <name> --root .`. The helper deletes the file and regenerates `MEMORY.md`.

## Verify

Run `npx claudepilot memory list --root .` again and confirm the memory is gone.

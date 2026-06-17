---
name: dispatching-parallel-agents
description: Use when several pieces of work are genuinely independent and can run at once, to fan them out across parallel agents instead of doing them in sequence. Cuts wall-clock time and keeps each strand in its own clean context.
slipstream:
  category: context
  requires: []
  tags:
    - orchestration
    - delegation
    - parallel
---

## Overview

Sequential work wastes time when the pieces do not depend on each other. Fanning independent strands out to parallel agents finishes them in the time of the slowest one, and each strand keeps its own focused context instead of crowding a single window. The discipline is knowing what is truly independent, briefing each strand so it needs nothing from the others, and reconciling the results once they all land.

This is the parallel sibling of [[subagent-driven-development]]: that skill runs tasks one at a time behind a review gate; this one runs them at once when nothing forces an order.

## Steps

1. List the strands of work and mark every dependency. Two strands are independent only when neither reads what the other writes and neither needs the other's result to start.
2. Drop anything with a dependency back into a sequence. Parallelise only the genuinely independent set; a hidden ordering will corrupt results silently.
3. Give each agent a self-contained brief: the exact files it owns, what done looks like, and how to verify it alone. No brief should reference another strand's output.
4. Keep the strands off each other's files. If two would edit the same file, they are not independent — split the file's responsibilities first or isolate them with [[using-git-worktrees]].
5. Collect every result, then reconcile: merge in a deterministic order and re-run the full checks once combined, so any interaction the isolation hid now surfaces.

## Verify

Every parallel strand owned a disjoint set of files, no brief depended on another strand's result, and the combined output passes the full suite after reconciliation.

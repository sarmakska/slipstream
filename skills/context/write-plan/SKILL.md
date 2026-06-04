---
name: write-plan
description: Use after a spec is agreed and before coding a multi-step change, to break the work into small, independently verifiable tasks with exact files and a check per task. A plan an agent can execute without re-deciding scope, and that survives compaction.
slipstream:
  category: context
  requires:
    - brainstorm-spec
  tags:
    - planning
    - discipline
    - token-efficiency
---

## Overview

A good plan is the difference between executing and improvising. Without one, a long change drifts: the agent re-decides scope every few turns, forgets what it already did after a compaction, and burns tokens reconstructing its own intent. This skill produces a plan made of small tasks — each a few minutes of work, each naming the exact files to touch and the exact check that proves it done — so execution is mechanical and a resumed session picks up precisely where it left off.

Each task in the plan has: a one-line goal, the specific files/symbols it changes, the steps, and a verification command. Keep tasks small enough that one can fail without dragging the others down, and order them so each builds on verified ground.

## Steps

1. Start from the agreed spec (run `brainstorm-spec` first if there is none).
2. Decompose the work into small tasks, each independently verifiable and a few minutes in size. Avoid mega-tasks that bundle unrelated changes.
3. For each task write: goal (one line), files/symbols touched, the concrete steps, and the verification command that proves it done.
4. Order the tasks so each depends only on tasks already verified before it; mark any human checkpoints.
5. Persist the plan: save it to `docs/plans/<short-name>.md` and record the open task with `sp_remember` (type `todo`) so the next session and the PreCompact digest carry it forward.

## Verify

A written plan exists where every task names its files and carries its own verification command, the tasks are ordered by dependency, and the plan is saved to disk and reflected in memory (`npx slipstream memory list --root .`). If any task has no way to prove it done, it is not specified well enough yet.

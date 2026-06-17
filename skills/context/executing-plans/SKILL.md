---
name: executing-plans
description: Use when a written plan exists and you are about to build it in the current session, to work it task by task with a checkpoint after each. Keeps execution honest against the plan instead of drifting into a freehand build.
slipstream:
  category: context
  requires: []
  tags:
    - planning
    - execution
    - verification
---

## Overview

A plan is only worth writing if it is followed. The failure mode is opening the plan, reading the goal, and then building from memory — the plan becomes decoration and the checkpoints never happen. This skill is the discipline of executing a plan as written: one task at a time, verify before moving on, and surface any divergence rather than quietly absorbing it.

It is the counterpart to [[write-plan]]: that skill produces the plan; this one spends it. For independent tasks you may hand each to a fresh agent ([[subagent-driven-development]]); this skill is the in-session path where you build the tasks yourself.

## Steps

1. Open the plan and work the tasks in order. Do not skim ahead and build the whole thing; the order encodes dependencies.
2. For each task, do exactly what it specifies, then run its stated verification before starting the next. A task is not done until its check is green.
3. Commit at each task boundary so the history matches the plan and a failed task is cheap to undo.
4. When reality contradicts the plan — a step is wrong, missing, or impossible — stop and fix the plan first, then continue. Never silently improvise past a divergence; the plan must stay the source of truth.
5. After the last task, re-run the full suite and the plan's overall acceptance criteria together, not just the final task's check.

## Verify

Every task was built and verified in plan order, each task boundary is a commit, any divergence was written back into the plan before continuing, and the full acceptance criteria pass at the end.

---
name: subagent-driven-development
description: Use when executing a multi-step plan whose tasks are independent, to dispatch a fresh agent per task and review between tasks. Keeps each task in a clean context, parallelises independent work, and gates each result before the next begins.
slipstream:
  category: context
  requires: []
  tags:
    - orchestration
    - planning
    - delegation
---

## Overview

A long plan run in one context drifts: early decisions fade, the window fills, and later tasks inherit the noise of earlier ones. Handing each task to a fresh agent keeps every task sharp and lets independent tasks run at once. This skill is the discipline for doing that without losing control: one task per agent, a clear hand-off, and a review gate before the next task starts.

## Steps

1. Confirm the work is a written plan of discrete tasks. If it is not yet a plan, write one first; do not dispatch against a vague goal.
2. Decide what is independent. Tasks that share no state and have no ordering dependency can run in parallel; the rest stay in sequence.
3. Hand each task a self-contained brief: the exact files, the expected behaviour, how to verify it, and the definition of done. The agent should not need the rest of the plan.
4. Review each result before continuing. Read the diff, confirm the verification ran, and reject or re-dispatch if it falls short. The gate is the point.
5. Integrate the accepted results in order, re-running the full checks once combined so cross-task interactions surface.

## Verify

Each task was reviewed against its brief before the next began, the independent tasks did not share mutable state, and the combined result passes the full suite.

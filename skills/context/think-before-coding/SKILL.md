---
name: think-before-coding
description: Use before writing or changing code on any non-trivial task, to surface hidden assumptions, keep the change minimal and surgical, and define how you will verify success. The discipline that stops over-engineering and wasted tokens before they happen.
slipstream:
  category: context
  requires: []
  tags:
    - discipline
    - planning
    - token-efficiency
---

## Overview

Most wasted work in a session is decided before the first edit: an assumption left unstated, a feature built that nobody asked for, a refactor that touched code unrelated to the task, or a change that "looks done" with no way to prove it. This skill is a short discipline to run first. It costs a few lines of thinking and saves whole turns of rework and the tokens that go with them.

Four habits, in order:

1. **Surface assumptions.** State what you are assuming about the request, the data, and the environment. If a key assumption is unverified, ask or check before coding rather than building on a guess. Present real trade-offs instead of silently picking one.
2. **Simplicity first.** Write the minimum code that satisfies the request. No speculative abstraction, no "while I'm here" extras, no configuration nobody asked for. The smallest correct change is also the cheapest to read and review.
3. **Surgical changes.** Touch only what the task requires. Do not reformat, rename, or refactor pre-existing code that is not part of the task; do not delete code you did not write without flagging it first. Orthogonal edits hide the real change and break review.
4. **Goal-driven execution.** Define a verifiable success criterion up front — the command, test, or observable behaviour that proves the task is done — then work until that criterion passes, not until the code merely looks plausible.

## Steps

1. Restate the task in one line and list the assumptions it rests on. Mark any that are unverified and resolve them (ask, or read with `sp_symbol` / `sp_search`) before editing.
2. Decide the smallest change that satisfies the task. Reject speculative features and abstractions you cannot justify from the request itself.
3. Identify exactly which files and symbols must change. Anything outside that set you leave alone unless you flag it explicitly and the user agrees.
4. Write down the success criterion now: the exact command or behaviour that will prove the change works.
5. Make the change, then run that criterion. Loop until it passes; do not declare done before it does.

## Verify

The change is complete only when the success criterion you wrote in step 4 actually passes (a green test, a clean build, or the observed behaviour), and the diff touches only the files the task required. If either is not true, you are not done.

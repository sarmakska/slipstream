---
name: using-git-worktrees
description: Use when work needs its own isolated checkout — parallel strands that would fight over files, or a risky change you want quarantined from the main tree. Gives each strand a real working directory on its own branch without re-cloning.
slipstream:
  category: context
  requires: []
  tags:
    - git
    - isolation
    - parallel
---

## Overview

A single working tree can only hold one state at a time, so two strands of work editing the same files collide, and a risky experiment contaminates the tree you trust. A git worktree gives a branch its own directory backed by the same repository: separate files, shared history, no second clone. It is the isolation layer that makes [[dispatching-parallel-agents]] safe when strands would otherwise overlap.

## Steps

1. Decide isolation is warranted. Use a worktree when strands would edit the same files, or when a change is risky enough that you want it quarantined from the main tree. For disjoint files, plain parallel work is simpler.
2. Create the worktree on a fresh branch: `git worktree add ../<name> -b <branch>`. It is a full directory you can build and test in independently.
3. Do the strand's work there in full — edit, build, run its verification — without touching the main tree.
4. Integrate by merging or opening a pull request from the branch once its checks are green, exactly as you would any branch.
5. Remove the worktree when done: `git worktree remove ../<name>`. Do not leave stale worktrees; they drift and confuse later sessions.

## Verify

Each isolated strand built and verified inside its own worktree, the main tree was never a shared edit surface, and every worktree was removed after its branch integrated.

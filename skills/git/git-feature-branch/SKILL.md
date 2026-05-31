---
name: git-feature-branch
description: >-
  Use when starting a new unit of work that should not land on the default
  branch: create a focused feature branch off the default branch for each unit
  of work.
claudepilot:
  category: git
  requires:
    - git-init-repo
  verification:
    kind: command
    description: The branch is checked out.
    command: git rev-parse --abbrev-ref HEAD
    expect: '{{branch}}'
  tags:
    - git
    - launch
---

## Overview

Create a focused feature branch off the default branch for each unit of work.

## Steps

1. Create the branch with `git switch -c {{branch}}`.
2. Keep the branch scoped to a single change so review is easy.
3. Rebase on the default branch before opening a pull request.

## Verify

Confirm `git rev-parse --abbrev-ref HEAD` reports the feature branch name.

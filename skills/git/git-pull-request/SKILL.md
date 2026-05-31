---
name: git-pull-request
description: >-
  Use when a feature branch is ready for review: push the feature branch and
  open a reviewable pull request with a clear description.
slipstream:
  category: git
  requires:
    - git-conventional-commit
  verification:
    kind: command
    description: A pull request exists for the branch.
    command: gh pr view --json number -q .number
  tags:
    - git
---

## Overview

Push the feature branch and open a reviewable pull request with a clear description.

## Steps

1. Push the branch with `git push -u origin HEAD`.
2. Open the pull request with `gh pr create` and a description of the change and how it was verified.
3. Request review and link any related issue.

## Verify

Run `gh pr view` and confirm a pull request number is returned for the current branch.

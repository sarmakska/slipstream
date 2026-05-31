---
name: git-conventional-commit
description: Record work as small conventional commits so history reads as a changelog.
claudepilot:
  category: git
  requires:
    - git-feature-branch
  verification:
    kind: command
    description: The latest commit follows the convention.
    command: git log -1 --pretty=%s
    expect: ':'
  tags:
    - git
    - launch
---

## Overview

Record work as small conventional commits so history reads as a changelog.

## Steps

1. Stage only the related changes.
2. Write a commit subject in the form `type(scope): summary`.
3. Keep the subject under seventy two characters and explain the why in the body.

## Verify

Run `git log -1 --pretty=%s` and confirm the subject matches the conventional commit format.

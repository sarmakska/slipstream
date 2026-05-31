---
name: git-init-repo
description: Initialise a Git repository with a sensible default branch and ignore file.
claudepilot:
  category: git
  verification:
    kind: command
    description: The repository has a default branch.
    command: git rev-parse --abbrev-ref HEAD
  tags:
    - git
    - launch
---

## Overview

Initialise a Git repository with a sensible default branch and ignore file.

## Steps

1. Run `git init -b main`.
2. Add a `.gitignore` covering node_modules, build output and local env files.
3. Make an initial commit so later work has a clean baseline.

## Verify

Run `git rev-parse --abbrev-ref HEAD` and confirm it prints `main`.

---
name: vercel-link
description: >-
  Link the local repository to a Vercel project so deploys and env vars are
  scoped correctly.
claudepilot:
  category: vercel
  verification:
    kind: command
    description: The project is linked.
    command: pnpm exec vercel project ls
    expect: Projects
  tags:
    - vercel
    - launch
---

## Overview

Link the local repository to a Vercel project so deploys and env vars are scoped correctly.

## Steps

1. Install the Vercel CLI and run `vercel link`.
2. Select or create the project and confirm the `.vercel/project.json` file is written.
3. Add `.vercel/` to `.gitignore`.

## Verify

Run `vercel project ls` and confirm the linked project is listed.

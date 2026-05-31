---
name: vercel-preview
description: Ensure every branch gets an isolated preview deployment for review.
claudepilot:
  category: vercel
  requires:
    - vercel-link
  verification:
    kind: command
    description: A preview deploy succeeds.
    command: pnpm exec vercel deploy
    expect: 'https://'
  tags:
    - vercel
    - ci
---

## Overview

Ensure every branch gets an isolated preview deployment for review.

## Steps

1. Connect the Git repository in the Vercel dashboard so pushes create previews automatically.
2. Confirm the preview URL is posted back to the pull request.
3. Use preview specific environment variables where needed.

## Verify

Trigger a preview deploy and confirm a unique preview URL is returned.

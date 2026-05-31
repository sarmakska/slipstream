---
name: vercel-env
description: >-
  Use when environment variables must reach Vercel: push environment variables
  to Vercel for the preview and production environments.
slipstream:
  category: vercel
  requires:
    - vercel-link
  verification:
    kind: command
    description: The variable is set.
    command: pnpm exec vercel env ls
    expect: '{{envName}}'
  tags:
    - vercel
    - config
    - launch
---

## Overview

Push environment variables to Vercel for the preview and production environments.

## Steps

1. Add the variable with `vercel env add {{envName}} production`.
2. Repeat for the preview environment if it differs.
3. Pull them locally with `vercel env pull .env.local` for development.

## Verify

Run `vercel env ls` and confirm the variable name appears for the target environment.

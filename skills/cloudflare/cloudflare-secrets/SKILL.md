---
name: cloudflare-secrets
description: >-
  Use when a Worker needs secret values kept out of source: store sensitive
  values as Worker secrets rather than committing them.
slipstream:
  category: cloudflare
  requires:
    - cloudflare-worker
  verification:
    kind: command
    description: The secret is listed.
    command: pnpm exec wrangler secret list
    expect: '{{secretName}}'
  tags:
    - cloudflare
    - security
---

## Overview

Store sensitive values as Worker secrets rather than committing them.

## Steps

1. Put the secret with `pnpm exec wrangler secret put {{secretName}}`.
2. Reference it from `env.{{secretName}}` inside the Worker.
3. Never log the secret value.

## Verify

List secrets and confirm the name appears without exposing the value.

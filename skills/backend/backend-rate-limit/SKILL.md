---
name: backend-rate-limit
description: >-
  Protect public endpoints with a token bucket rate limiter keyed by client
  identity.
claudepilot:
  category: backend
  requires:
    - backend-hono-api
  verification:
    kind: test
    description: Rate limit tests pass.
    command: 'pnpm --dir {{apiDir}} test'
  tags:
    - api
    - security
---

## Overview

Protect public endpoints with a token bucket rate limiter keyed by client identity.

## Steps

1. Implement a token bucket keyed by API key or IP address.
2. Return `429` with a `Retry-After` header when the bucket is empty.
3. Exempt the health endpoint from limiting.

## Verify

Run the tests, then fire requests past the limit and confirm a 429 with `Retry-After` is returned.

---
name: backend-hono-api
description: >-
  Use when scaffolding an HTTP API that runs on Node and the edge: create a Hono
  based HTTP API that runs on both Node and edge runtimes.
slipstream:
  category: backend
  verification:
    kind: typecheck
    description: The API typechecks.
    command: 'pnpm --dir {{apiDir}} exec tsc --noEmit'
  tags:
    - api
    - launch
---

## Overview

Create a Hono based HTTP API that runs on both Node and edge runtimes.

## Steps

1. Install `hono` and create an app with a `GET /health` route returning `{ ok: true }`.
2. Add a typed router module per resource and mount them under a versioned `/v1` base path.
3. Export the app so the same instance can serve Node, Cloudflare Workers and Vercel.

## Verify

Typecheck the API and curl `/health`, expecting a 200 with `{"ok":true}`.

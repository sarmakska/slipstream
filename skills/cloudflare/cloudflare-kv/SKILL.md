---
name: cloudflare-kv
description: >-
  Use when you need a low-latency edge cache or key-value store: create a
  Workers KV namespace and use it as a low latency cache.
claudepilot:
  category: cloudflare
  requires:
    - cloudflare-worker
  verification:
    kind: command
    description: The namespace is created.
    command: pnpm exec wrangler kv namespace list
    expect: '{{namespace}}'
  tags:
    - cloudflare
    - cache
---

## Overview

Create a Workers KV namespace and use it as a low latency cache.

## Steps

1. Create the namespace with `pnpm exec wrangler kv namespace create {{namespace}}`.
2. Bind it in `wrangler.toml` and cache expensive responses with a TTL.
3. Invalidate the cache key when the underlying data changes.

## Verify

List KV namespaces and confirm the new namespace appears, then read a cached value back through the Worker.

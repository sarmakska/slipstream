---
name: cloudflare-worker
description: Create a Cloudflare Worker with Wrangler that serves an API at the edge.
claudepilot:
  category: cloudflare
  verification:
    kind: command
    description: The worker builds via a dry run deploy.
    command: 'pnpm exec wrangler deploy --dry-run --outdir /tmp/{{workerName}}'
    expect: Total Upload
  tags:
    - cloudflare
    - launch
---

## Overview

Create a Cloudflare Worker with Wrangler that serves an API at the edge.

## Steps

1. Install `wrangler` and create `wrangler.toml` with the worker name and a `main` entry.
2. Implement a `fetch` handler returning a JSON response.
3. Set `compatibility_date` to a recent date.

## Verify

Run a Wrangler dry run deploy and confirm it reports a successful upload size with no build errors.

---
name: cloudflare-r2
description: >-
  Use when the app needs object storage on Cloudflare: create an R2 object
  storage bucket and bind it to a Worker.
claudepilot:
  category: cloudflare
  requires:
    - cloudflare-worker
  verification:
    kind: command
    description: The bucket exists.
    command: pnpm exec wrangler r2 bucket list
    expect: '{{bucket}}'
  tags:
    - cloudflare
    - storage
---

## Overview

Create an R2 object storage bucket and bind it to a Worker.

## Steps

1. Create the bucket with `pnpm exec wrangler r2 bucket create {{bucket}}`.
2. Add an `[[r2_buckets]]` binding to `wrangler.toml`.
3. Read and write objects through the binding from the Worker.

## Verify

List R2 buckets and confirm the new bucket name appears in the output.

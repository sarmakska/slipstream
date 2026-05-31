---
name: cloudflare-d1
description: >-
  Use when the app needs a SQLite database on Cloudflare: create a Cloudflare D1
  SQLite database and run an initial migration.
claudepilot:
  category: cloudflare
  requires:
    - cloudflare-worker
  verification:
    kind: command
    description: The database is created.
    command: pnpm exec wrangler d1 list
    expect: '{{dbName}}'
  tags:
    - cloudflare
    - database
---

## Overview

Create a Cloudflare D1 SQLite database and run an initial migration.

## Steps

1. Create the database with `pnpm exec wrangler d1 create {{dbName}}`.
2. Add the `[[d1_databases]]` binding to `wrangler.toml`.
3. Apply a schema migration with `wrangler d1 execute`.

## Verify

List D1 databases and confirm the database appears, then run a `SELECT 1` to confirm connectivity.

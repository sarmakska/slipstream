---
name: supabase-schema
description: >-
  Use when authoring the database tables for a feature: author a SQL migration
  that creates your core tables with sensible constraints.
claudepilot:
  category: supabase
  requires:
    - supabase-init
  verification:
    kind: command
    description: The migration applies cleanly to the local database.
    command: supabase db reset
    expect: Applying migration
  tags:
    - supabase
    - schema
    - launch
---

## Overview

Author a SQL migration that creates your core tables with sensible constraints.

## Steps

1. Create a migration with `supabase migration new create_{{table}}`.
2. Define the table with a UUID primary key, `created_at` default `now()`, and foreign keys.
3. Add indexes for the columns you will filter on most.

## Verify

Run `supabase db reset` and confirm the migration is listed as applied with no SQL errors.

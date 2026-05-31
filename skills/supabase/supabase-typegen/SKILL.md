---
name: supabase-typegen
description: >-
  Use when you want fully typed database queries: generate TypeScript types from
  the database schema so queries are fully typed.
claudepilot:
  category: supabase
  requires:
    - supabase-schema
  verification:
    kind: typecheck
    description: The generated types compile.
    command: 'pnpm --dir {{appName}} exec tsc --noEmit'
  tags:
    - supabase
    - types
---

## Overview

Generate TypeScript types from the database schema so queries are fully typed.

## Steps

1. Run `supabase gen types typescript --local` and write the output to `src/database.types.ts`.
2. Parameterise the Supabase client with the generated `Database` type.
3. Regenerate types whenever a migration changes the schema.

## Verify

Typecheck the app and confirm a deliberately wrong column name now raises a compile error.

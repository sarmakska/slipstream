---
name: supabase-rls
description: >-
  Lock down tables with row level security so users only read and write their
  own rows.
claudepilot:
  category: supabase
  requires:
    - supabase-schema
  verification:
    kind: command
    description: RLS migration applies.
    command: supabase db reset
    expect: Applying migration
  tags:
    - supabase
    - security
    - launch
---

## Overview

Lock down tables with row level security so users only read and write their own rows.

## Steps

1. Run `ALTER TABLE {{table}} ENABLE ROW LEVEL SECURITY`.
2. Add a select policy `auth.uid() = user_id` and matching insert and update policies.
3. Test that an anonymous client cannot read another user's rows.

## Verify

Reset the database, then query the table as two different users and confirm each sees only their own rows.

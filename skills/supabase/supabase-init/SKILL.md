---
name: supabase-init
description: Link a local Supabase project and start the local development stack.
claudepilot:
  category: supabase
  verification:
    kind: command
    description: The Supabase CLI reports a running local stack.
    command: supabase status
    expect: API URL
  tags:
    - supabase
    - launch
---

## Overview

Link a local Supabase project and start the local development stack.

## Steps

1. Run `supabase init` to create the `supabase/` directory.
2. Run `supabase link --project-ref {{projectRef}}` against your hosted project.
3. Start the local stack with `supabase start`.

## Verify

Run `supabase status` and confirm the output contains an `API URL`, proving the local stack is up.

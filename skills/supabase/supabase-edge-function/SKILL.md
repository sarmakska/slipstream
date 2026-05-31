---
name: supabase-edge-function
description: >-
  Use when you need server-side logic close to the Supabase data: write and
  deploy a Deno based edge function for server side logic close to the data.
slipstream:
  category: supabase
  requires:
    - supabase-init
  verification:
    kind: command
    description: The function deploys.
    command: 'supabase functions deploy {{fnName}}'
    expect: Deployed
  tags:
    - supabase
    - edge
---

## Overview

Write and deploy a Deno based edge function for server side logic close to the data.

## Steps

1. Create the function with `supabase functions new {{fnName}}`.
2. Read secrets from the environment rather than hard coding them.
3. Deploy with `supabase functions deploy {{fnName}}`.

## Verify

Deploy the function and invoke it with a test payload, confirming a 200 response.

---
name: backend-zod-validation
description: >-
  Use when API input must be validated and rejected if malformed: add schema
  validation middleware so every endpoint rejects malformed input with a 400.
claudepilot:
  category: backend
  requires:
    - backend-hono-api
  verification:
    kind: test
    description: Validation tests pass.
    command: 'pnpm --dir {{apiDir}} test'
  tags:
    - api
    - validation
---

## Overview

Add schema validation middleware so every endpoint rejects malformed input with a 400.

## Steps

1. Install `@hono/zod-validator`.
2. Define a Zod schema for each POST and PUT body and attach the validator middleware.
3. Return a structured error payload listing the failing fields.

## Verify

Run the API tests, then post an invalid body and confirm a 400 with a field level error list.

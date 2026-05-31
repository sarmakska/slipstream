---
name: resend-setup
description: Add the Resend SDK and configure the API key for transactional email.
claudepilot:
  category: resend
  verification:
    kind: typecheck
    description: Resend client code typechecks.
    command: 'pnpm --dir {{apiDir}} exec tsc --noEmit'
  tags:
    - resend
    - email
    - launch
---

## Overview

Add the Resend SDK and configure the API key for transactional email.

## Steps

1. Install `resend` and read `RESEND_API_KEY` from the environment.
2. Create a single shared client module.
3. Fail fast with a clear message if the key is missing.

## Verify

Typecheck the project and confirm the client constructs without throwing when the key is present.

---
name: payments-stripe-setup
description: >-
  Use when first adding Stripe to a project: install the Stripe SDK and
  configure keys for accepting payments.
claudepilot:
  category: payments
  verification:
    kind: typecheck
    description: Stripe client code typechecks.
    command: 'pnpm --dir {{apiDir}} exec tsc --noEmit'
  tags:
    - payments
    - launch
---

## Overview

Install the Stripe SDK and configure keys for accepting payments.

## Steps

1. Install `stripe` and read the secret key from the environment.
2. Create a single shared Stripe client pinned to a specific API version.
3. Use test mode keys in development.

## Verify

Typecheck the project and confirm the client constructs against the pinned API version.

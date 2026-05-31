---
name: payments-checkout
description: Start a hosted Stripe Checkout session for a one time purchase.
claudepilot:
  category: payments
  requires:
    - payments-stripe-setup
  verification:
    kind: test
    description: Checkout session tests pass.
    command: 'pnpm --dir {{apiDir}} test'
  tags:
    - payments
    - launch
---

## Overview

Start a hosted Stripe Checkout session for a one time purchase.

## Steps

1. Create a Checkout session with line items and success and cancel URLs.
2. Redirect the client to the session URL.
3. Pass an idempotency key to avoid duplicate charges on retry.

## Verify

Run the tests with the Stripe client mocked and confirm a session is created with the correct line items.

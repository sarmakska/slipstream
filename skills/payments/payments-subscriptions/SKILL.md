---
name: payments-subscriptions
description: Sell recurring subscriptions with Stripe Billing and manage plan changes.
claudepilot:
  category: payments
  requires:
    - payments-checkout
  verification:
    kind: test
    description: Subscription tests pass.
    command: 'pnpm --dir {{apiDir}} test'
  tags:
    - payments
---

## Overview

Sell recurring subscriptions with Stripe Billing and manage plan changes.

## Steps

1. Create products and recurring prices in Stripe.
2. Start subscriptions through Checkout in subscription mode.
3. Handle upgrades, downgrades and cancellations with proration.

## Verify

Run the tests and confirm a plan change request produces the expected proration call.

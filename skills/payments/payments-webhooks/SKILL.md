---
name: payments-webhooks
description: >-
  Use when payment state must stay in sync with Stripe: receive and verify
  Stripe webhook events to keep your records in sync with Stripe.
slipstream:
  category: payments
  requires:
    - payments-stripe-setup
    - backend-hono-api
  verification:
    kind: test
    description: Webhook verification tests pass.
    command: 'pnpm --dir {{apiDir}} test'
  tags:
    - payments
    - security
    - launch
---

## Overview

Receive and verify Stripe webhook events to keep your records in sync with Stripe.

## Steps

1. Add a `POST /webhooks/stripe` route that reads the raw body.
2. Verify the signature with the webhook signing secret before parsing.
3. Handle `checkout.session.completed` and `invoice.paid` idempotently.

## Verify

Run the tests with a signed event and confirm an event with a bad signature is rejected with a 400.

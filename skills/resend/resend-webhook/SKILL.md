---
name: resend-webhook
description: >-
  Use when you need to track email delivery, bounces and complaints: receive
  Resend webhooks to track delivery, bounce and complaint events.
slipstream:
  category: resend
  requires:
    - resend-setup
    - backend-hono-api
  verification:
    kind: test
    description: Webhook handler tests pass.
    command: 'pnpm --dir {{apiDir}} test'
  tags:
    - resend
    - email
---

## Overview

Receive Resend webhooks to track delivery, bounce and complaint events.

## Steps

1. Add a `POST /webhooks/resend` route.
2. Verify the webhook signature before trusting the payload.
3. Record bounces and complaints so you can suppress bad addresses.

## Verify

Run the tests with a signed sample payload and confirm a bounce event marks the address as suppressed.

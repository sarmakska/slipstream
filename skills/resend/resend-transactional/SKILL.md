---
name: resend-transactional
description: Send a templated transactional email such as a welcome or receipt message.
claudepilot:
  category: resend
  requires:
    - resend-setup
  verification:
    kind: test
    description: Email sending tests pass with a mocked client.
    command: 'pnpm --dir {{apiDir}} test'
  tags:
    - resend
    - email
    - launch
---

## Overview

Send a templated transactional email such as a welcome or receipt message.

## Steps

1. Compose an HTML and plain text version of the message.
2. Send through the shared Resend client and handle the response id.
3. Mock the client in tests so the suite never sends real email.

## Verify

Run the tests with the Resend client mocked and confirm the send function is called with the expected payload.

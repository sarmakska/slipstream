---
name: auth-password-reset
description: >-
  Let users reset a forgotten password with a single use, time limited token
  sent by email.
claudepilot:
  category: auth
  requires:
    - auth-session
    - resend-transactional
  verification:
    kind: test
    description: Password reset tests pass.
    command: 'pnpm --dir {{apiDir}} test'
  tags:
    - auth
    - email
---

## Overview

Let users reset a forgotten password with a single use, time limited token sent by email.

## Steps

1. Generate a single use token with a short expiry and store its hash.
2. Email the reset link through Resend.
3. Invalidate the token after use and on a successful reset.

## Verify

Run the tests and confirm a reused or expired token is rejected.

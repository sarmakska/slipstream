---
name: auth-session
description: >-
  Use when issuing authenticated session cookies: issue HTTP only, secure, same
  site session cookies for authenticated requests.
claudepilot:
  category: auth
  requires:
    - backend-hono-api
  verification:
    kind: test
    description: Session tests pass.
    command: 'pnpm --dir {{apiDir}} test'
  tags:
    - auth
    - security
    - launch
---

## Overview

Issue HTTP only, secure, same site session cookies for authenticated requests.

## Steps

1. Set the session cookie with `HttpOnly`, `Secure`, `SameSite=Lax` and a sensible `Max-Age`.
2. Sign or encrypt the cookie payload so it cannot be tampered with.
3. Rotate the session on privilege change.

## Verify

Run the tests and confirm the issued cookie carries the HttpOnly and Secure flags.

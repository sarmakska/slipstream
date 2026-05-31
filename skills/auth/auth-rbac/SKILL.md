---
name: auth-rbac
description: >-
  Use when routes or actions must be gated by user role: gate routes and actions
  behind roles so only authorised users can perform them.
claudepilot:
  category: auth
  requires:
    - auth-session
  verification:
    kind: test
    description: RBAC tests pass.
    command: 'pnpm --dir {{apiDir}} test'
  tags:
    - auth
    - security
---

## Overview

Gate routes and actions behind roles so only authorised users can perform them.

## Steps

1. Attach a role claim to the session at sign in.
2. Add middleware that checks the required role for protected routes.
3. Return 403 rather than 404 for an authenticated but unauthorised user.

## Verify

Run the tests and confirm a user without the required role receives a 403 on a protected route.

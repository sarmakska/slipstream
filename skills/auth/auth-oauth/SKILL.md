---
name: auth-oauth
description: Add a third party OAuth provider such as GitHub or Google for social sign in.
claudepilot:
  category: auth
  requires:
    - auth-session
  verification:
    kind: typecheck
    description: OAuth flow code typechecks.
    command: pnpm exec tsc --noEmit
  tags:
    - auth
---

## Overview

Add a third party OAuth provider such as GitHub or Google for social sign in.

## Steps

1. Register an OAuth app with the provider and store the client id and secret as secrets.
2. Implement the authorisation redirect and the callback token exchange.
3. Validate the `state` parameter to prevent CSRF.

## Verify

Typecheck the project, then walk the full redirect and callback flow and confirm a session is created.

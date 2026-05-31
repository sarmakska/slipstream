---
name: supabase-auth
description: >-
  Add email and password authentication backed by Supabase Auth in the front
  end.
claudepilot:
  category: supabase
  requires:
    - supabase-init
  verification:
    kind: typecheck
    description: Auth client code typechecks.
    command: 'pnpm --dir {{appName}} exec tsc --noEmit'
  tags:
    - supabase
    - auth
    - launch
---

## Overview

Add email and password authentication backed by Supabase Auth in the front end.

## Steps

1. Install `@supabase/supabase-js` and create a typed client from the project URL and anon key.
2. Implement sign up, sign in and sign out flows with error handling.
3. Persist the session and expose the current user through a context.

## Verify

Typecheck the app, then sign up a test user and confirm a session token is returned and stored.

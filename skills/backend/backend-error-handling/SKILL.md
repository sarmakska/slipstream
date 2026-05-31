---
name: backend-error-handling
description: >-
  Use when an API needs consistent error responses: catch unhandled errors
  centrally and return consistent JSON error envelopes.
claudepilot:
  category: backend
  requires:
    - backend-hono-api
  verification:
    kind: test
    description: Error handling tests pass.
    command: 'pnpm --dir {{apiDir}} test'
  tags:
    - api
---

## Overview

Catch unhandled errors centrally and return consistent JSON error envelopes.

## Steps

1. Register an `app.onError` handler that maps known error types to HTTP status codes.
2. Never leak stack traces in production responses; log them server side instead.
3. Return a stable `{ error: { code, message } }` shape.

## Verify

Run the API tests including a route that throws, and confirm the response is a clean JSON envelope with the right status.

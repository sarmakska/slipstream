---
name: frontend-router
description: >-
  Use when a front end needs multiple pages and routing: install a router and
  define the page routes for a multi page front end.
slipstream:
  category: frontend
  requires:
    - frontend-vite-react
  verification:
    kind: typecheck
    description: Route components typecheck.
    command: 'pnpm --dir {{appName}} exec tsc --noEmit'
  tags:
    - routing
    - launch
---

## Overview

Install a router and define the page routes for a multi page front end.

## Steps

1. Install `react-router-dom`.
2. Define a `RouterProvider` with routes for home, pricing and contact.
3. Lazy load heavier routes so the initial bundle stays small.

## Verify

Run a typecheck and load each route in the dev server to confirm it renders without a console error.

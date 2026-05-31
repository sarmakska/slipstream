---
name: frontend-forms
description: >-
  Use when building forms that need validation and accessible errors: build
  forms with client side validation and accessible error messaging.
slipstream:
  category: frontend
  requires:
    - frontend-vite-react
  verification:
    kind: typecheck
    description: Form schemas typecheck.
    command: 'pnpm --dir {{appName}} exec tsc --noEmit'
  tags:
    - forms
---

## Overview

Build forms with client side validation and accessible error messaging.

## Steps

1. Install `react-hook-form` and `zod` with the `@hookform/resolvers` adapter.
2. Define a Zod schema per form and infer the field types from it.
3. Surface validation errors next to each field with an `aria-describedby` link.

## Verify

Typecheck, then submit a form with invalid input and confirm the error text appears and submission is blocked.

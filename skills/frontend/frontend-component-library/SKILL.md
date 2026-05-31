---
name: frontend-component-library
description: >-
  Create a small set of reusable, accessible UI primitives the rest of the site
  composes from.
claudepilot:
  category: frontend
  requires:
    - frontend-vite-react
  verification:
    kind: typecheck
    description: Components typecheck.
    command: 'pnpm --dir {{appName}} exec tsc --noEmit'
  tags:
    - components
---

## Overview

Create a small set of reusable, accessible UI primitives the rest of the site composes from.

## Steps

1. Create `src/components/ui` with `Button`, `Input`, `Card` and `Container` primitives.
2. Give every primitive a typed props interface and sensible default styling.
3. Export the primitives from a single barrel file for easy import.

## Verify

Typecheck the project and render each primitive once on a scratch page to confirm props and styling resolve.

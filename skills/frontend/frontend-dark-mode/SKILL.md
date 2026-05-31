---
name: frontend-dark-mode
description: >-
  Add a persisted light and dark theme toggle driven by a CSS class on the root
  element.
claudepilot:
  category: frontend
  requires:
    - frontend-tailwind
  verification:
    kind: typecheck
    description: Theme code typechecks.
    command: 'pnpm --dir {{appName}} exec tsc --noEmit'
  tags:
    - theming
---

## Overview

Add a persisted light and dark theme toggle driven by a CSS class on the root element.

## Steps

1. Enable Tailwind `darkMode: 'class'` and toggle a `dark` class on `document.documentElement`.
2. Persist the choice in `localStorage` and respect `prefers-color-scheme` on first load.
3. Expose a single accessible toggle button in the header.

## Verify

Typecheck, toggle the theme, reload the page, and confirm the chosen theme survives the reload.

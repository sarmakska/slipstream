---
name: frontend-responsive-layout
description: >-
  Use when laying out a marketing or landing page that must work on mobile and
  desktop: compose a responsive hero, features and footer layout that holds up
  from mobile to desktop.
claudepilot:
  category: frontend
  requires:
    - frontend-tailwind
  verification:
    kind: build
    description: The layout builds.
    command: 'pnpm --dir {{appName}} build'
  tags:
    - layout
    - launch
---

## Overview

Compose a responsive hero, features and footer layout that holds up from mobile to desktop.

## Steps

1. Build a hero, a three column feature grid, and a footer using semantic landmarks.
2. Use responsive utility breakpoints so the grid collapses to one column on small screens.
3. Verify colour contrast meets WCAG AA for body text.

## Verify

Build the app and inspect the layout at 375px, 768px and 1280px widths to confirm it reflows cleanly.

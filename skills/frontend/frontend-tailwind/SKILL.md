---
name: frontend-tailwind
description: >-
  Use when adding Tailwind CSS to a Vite project: wire Tailwind CSS into a Vite
  project for utility first styling.
slipstream:
  category: frontend
  requires:
    - frontend-vite-react
  verification:
    kind: build
    description: The app builds with Tailwind processing applied.
    command: 'pnpm --dir {{appName}} build'
  tags:
    - styling
    - launch
---

## Overview

Wire Tailwind CSS into a Vite project for utility first styling.

## Steps

1. Install `tailwindcss`, `postcss` and `autoprefixer` as dev dependencies.
2. Create `tailwind.config.js` with the `content` glob pointing at `./index.html` and `./src/**/*.{ts,tsx}`.
3. Add the three `@tailwind` directives to `src/index.css` and import it from the app entry.

## Verify

Build the app and grep the emitted CSS bundle for a Tailwind utility class such as `flex` to confirm processing ran.

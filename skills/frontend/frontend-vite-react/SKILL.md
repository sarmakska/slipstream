---
name: frontend-vite-react
description: >-
  Use when starting a new React single-page front end: create a Vite single page
  app with React and TypeScript as the front end foundation.
claudepilot:
  category: frontend
  verification:
    kind: build
    description: The fresh app builds without errors.
    command: 'pnpm --dir {{appName}} build'
  tags:
    - scaffold
    - launch
    - react
---

## Overview

Create a Vite single page app with React and TypeScript as the front end foundation.

## Steps

1. Run `pnpm create vite@latest {{appName}} -- --template react-ts`.
2. Install dependencies with `pnpm --dir {{appName}} install`.
3. Commit the scaffold before adding features so you have a clean baseline.

## Verify

Run `pnpm --dir {{appName}} build` and confirm a `dist/` directory is produced with a zero exit code.

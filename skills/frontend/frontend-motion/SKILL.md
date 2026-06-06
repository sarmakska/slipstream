---
name: frontend-motion
description: >-
  Use when a site needs the smooth entrance and scroll-reveal animations that
  make a page feel alive and crafted, to add tasteful motion with a real
  animation library rather than ad-hoc transitions.
slipstream:
  category: frontend
  requires:
    - frontend-vite-react
  verification:
    kind: build
    description: The app builds with the motion library and animations in place.
    command: 'pnpm --dir {{appName}} build'
  tags:
    - design
    - motion
    - polish
---

## Overview

The "designed in a tool" feel is often motion: elements that ease in as they enter the viewport, hover states that respond, transitions that are smooth rather than instant. This skill adds that with a dedicated animation library so the motion is consistent and accessible, not a pile of one-off CSS transitions.

## Steps

1. Install the motion library (`motion`, the successor to framer-motion) as a dependency.
2. Wrap entrance elements in an animated component with a small, consistent preset: fade and rise (opacity 0 to 1, y 12px to 0) over about 0.4s with an ease-out curve.
3. Trigger entrances on scroll with a whileInView variant and `viewport={{ once: true }}` so sections reveal as the user reaches them and do not replay.
4. Stagger groups (cards, list items) with a small per-child delay so a row resolves as a sequence rather than all at once.
5. Respect `prefers-reduced-motion`: gate the animations so users who ask for less motion get an instant, static layout. Motion is an enhancement, never a requirement to read the page.

## Verify

Build the app and confirm it compiles with the motion library, then load the page and check that sections fade and rise into view on scroll, and that enabling reduced-motion in the OS turns the animations off without breaking the layout.

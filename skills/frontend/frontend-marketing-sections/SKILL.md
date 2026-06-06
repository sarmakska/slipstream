---
name: frontend-marketing-sections
description: >-
  Use when filling out a landing page below the hero, to build the polished
  marketing sections a premium site is made of: a feature grid, a logo or
  social-proof strip, a testimonial and a closing call to action.
slipstream:
  category: frontend
  requires:
    - frontend-design-system
  verification:
    kind: build
    description: The app builds with the marketing sections in place.
    command: 'pnpm --dir {{appName}} build'
  tags:
    - design
    - landing
    - polish
---

## Overview

A landing page is a sequence of well-spaced sections that each do one job. Polished ones share a rhythm: consistent vertical spacing, a single column of attention, and restraint. This skill builds the common set on top of the design system so they read as one coherent page rather than stacked widgets.

## Steps

1. Establish a section rhythm: a shared container max-width and a consistent vertical padding token used by every section, so the page breathes evenly.
2. Build a feature grid: three or six items, each an icon, a short title and one sentence, on a responsive grid that collapses to one column on small screens. No item is visually louder than the others.
3. Add a social-proof strip: a muted row of logos or a single strong metric, kept quiet so it supports rather than competes.
4. Add one testimonial: a single quote at a larger size with an attribution, given space rather than boxed in decoration.
5. Close with one call-to-action section that restates the primary action from the hero, using the same accent token so the page resolves where it began.

## Verify

Build the app and confirm it compiles, then load the page and check the sections share consistent spacing, the feature grid reflows to one column on a narrow viewport, and the closing call to action matches the hero's primary action.

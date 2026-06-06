---
name: frontend-hero-section
description: >-
  Use when building the top of a landing page, to produce a high-impact hero
  with confident display type, a clear single call to action and balanced
  composition, the kind of opening a polished marketing site leads with.
slipstream:
  category: frontend
  requires:
    - frontend-design-system
  verification:
    kind: build
    description: The app builds with the hero section in place.
    command: 'pnpm --dir {{appName}} build'
  tags:
    - design
    - landing
    - polish
---

## Overview

The hero decides whether a visitor stays. A polished one is not busy: it is one strong line, one supporting sentence, one primary action, and generous space around them. This skill builds that, leaning on the design system tokens so it matches the rest of the site.

## Steps

1. Lead with one headline in the display face at a large clamp-based size (for example `clamp(2.5rem, 6vw, 5rem)`) with tight tracking and a balanced two or three line wrap.
2. Add one supporting sentence in the body face at a muted foreground, capped to a readable measure (around 60 characters) and centred or left-aligned consistently with the layout.
3. Give exactly one primary call to action and at most one secondary. The primary uses the accent token; the secondary is a quiet ghost button.
4. Compose with space, not decoration: generous vertical padding, a max-width container, and a single restrained background treatment (a soft gradient or a subtle grid), never several at once.
5. Make it responsive by construction: the clamp type, a single column on small screens widening to a balanced layout on large, and no fixed pixel heights.

## Verify

Build the app and confirm it compiles, then load the page and check the hero shows one headline, one supporting line and a single primary action, with the type scaling smoothly between a narrow and a wide viewport.

---
name: frontend-design-system
description: >-
  Use when a site needs to look designed rather than defaulted, before building
  sections: establish a cohesive design system of type scale, spacing, colour,
  radius and shadow tokens so every component shares one premium visual language.
slipstream:
  category: frontend
  requires:
    - frontend-tailwind
  verification:
    kind: build
    description: The app builds with the design tokens applied.
    command: 'pnpm --dir {{appName}} build'
  tags:
    - design
    - polish
    - tokens
---

## Overview

The difference between a site that looks default and one that looks made in a design tool is consistency: one type scale, one spacing rhythm, one restrained palette, applied everywhere. This skill sets that foundation in the Tailwind theme so every later section inherits it, which is what gives the polished, deliberate feel.

## Steps

1. Extend the Tailwind theme rather than overriding it. In `tailwind.config.js`, set a modular type scale (for example a 1.25 ratio from a 16px base) and a spacing rhythm on a consistent step.
2. Pick a restrained palette: one accent, a neutral ramp of five to seven greys, and clearly defined foreground and background tokens. Avoid more than one accent hue.
3. Choose a font pairing: a confident display face for headings and a clean, legible face for body, loaded with `font-display: swap`. Map them to `fontFamily.display` and `fontFamily.sans`.
4. Define radius and shadow scales (for example `rounded-xl` defaults and a soft layered shadow token) so cards and buttons share one physical language.
5. Set base styles on `body`: the background token, the body font, antialiasing and a comfortable line height, so unstyled text already looks intentional.

## Verify

Build the app and confirm it compiles with the extended theme, then grep the emitted CSS for one of the custom tokens (a custom colour or the display font) to confirm the theme is wired in rather than ignored.

---
name: seo-open-graph
description: Add social preview metadata so shared links render rich cards.
claudepilot:
  category: seo
  requires:
    - seo-meta-tags
  verification:
    kind: build
    description: The site builds with social tags.
    command: 'pnpm --dir {{appName}} build'
  tags:
    - seo
---

## Overview

Add social preview metadata so shared links render rich cards.

## Steps

1. Add `og:title`, `og:description`, `og:image` and `og:url` tags.
2. Add the matching `twitter:card` tags.
3. Provide a 1200 by 630 pixel preview image.

## Verify

Build the site and validate the home page with a social card debugger to confirm the preview renders.

---
name: analytics-plausible
description: >-
  Use when adding privacy-friendly site analytics: add a lightweight, cookieless
  analytics script that respects visitor privacy.
slipstream:
  category: analytics
  requires:
    - frontend-vite-react
  verification:
    kind: build
    description: The site builds with the analytics snippet.
    command: 'pnpm --dir {{appName}} build'
  tags:
    - analytics
    - launch
---

## Overview

Add a lightweight, cookieless analytics script that respects visitor privacy.

## Steps

1. Add the analytics script tag with your `{{domain}}` to the document head.
2. Avoid loading it during local development.
3. Document what is and is not collected in your privacy policy.

## Verify

Build the site and confirm the analytics snippet is present in the production HTML but absent in dev.

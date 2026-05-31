---
name: seo-meta-tags
description: >-
  Use when pages need title, description and canonical tags for search: add
  title, description and canonical tags to every page for search engines.
slipstream:
  category: seo
  requires:
    - frontend-router
  verification:
    kind: build
    description: The site builds with meta tags.
    command: 'pnpm --dir {{appName}} build'
  tags:
    - seo
    - launch
---

## Overview

Add title, description and canonical tags to every page for search engines.

## Steps

1. Set a unique `<title>` and meta description per route.
2. Add a canonical link tag to avoid duplicate content penalties.
3. Keep titles under sixty characters and descriptions under one hundred sixty.

## Verify

Build the site and inspect the rendered head of two routes to confirm distinct titles and canonicals.

---
name: seo-structured-data
description: >-
  Use when pages need JSON-LD so search engines understand the content: add
  JSON-LD structured data so search engines understand your content.
claudepilot:
  category: seo
  requires:
    - seo-meta-tags
  verification:
    kind: build
    description: The site builds with structured data.
    command: 'pnpm --dir {{appName}} build'
  tags:
    - seo
---

## Overview

Add JSON-LD structured data so search engines understand your content.

## Steps

1. Add an Organisation JSON-LD block on the home page.
2. Add Product or Article schema on the relevant pages.
3. Validate the markup against the schema.org vocabulary.

## Verify

Build the site and run the home page through a structured data validator to confirm no errors.

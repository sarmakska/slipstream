---
name: seo-sitemap
description: Emit a sitemap.xml and robots.txt so crawlers can discover and index pages.
claudepilot:
  category: seo
  requires:
    - frontend-router
  verification:
    kind: command
    description: The sitemap is well formed XML.
    command: >-
      node -e "const
      x=require('fs').readFileSync('{{appName}}/public/sitemap.xml','utf8');
      if(!x.includes('<urlset')) process.exit(1)"
  tags:
    - seo
    - launch
---

## Overview

Emit a sitemap.xml and robots.txt so crawlers can discover and index pages.

## Steps

1. Generate `public/sitemap.xml` listing every public route with a last modified date.
2. Write `public/robots.txt` pointing at the sitemap.
3. Regenerate the sitemap as part of the build.

## Verify

Read sitemap.xml and confirm it contains a `<urlset>` element with one URL per public route.

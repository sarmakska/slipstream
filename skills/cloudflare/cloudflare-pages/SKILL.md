---
name: cloudflare-pages
description: >-
  Use when deploying a static front end to Cloudflare Pages: publish a built
  static front end to Cloudflare Pages.
claudepilot:
  category: cloudflare
  requires:
    - frontend-vite-react
  verification:
    kind: healthcheck
    description: The deployed site responds 200.
    command: >-
      curl -fsS -o /dev/null -w '%{http_code}'
      https://{{pagesProject}}.pages.dev
    expect: '200'
  tags:
    - cloudflare
    - deploy
    - launch
---

## Overview

Publish a built static front end to Cloudflare Pages.

## Steps

1. Build the front end with `pnpm --dir {{appName}} build`.
2. Deploy with `pnpm exec wrangler pages deploy {{appName}}/dist --project-name {{pagesProject}}`.
3. Configure the custom domain in the Cloudflare dashboard.

## Verify

Curl the deployed Pages URL and confirm a 200 status code.

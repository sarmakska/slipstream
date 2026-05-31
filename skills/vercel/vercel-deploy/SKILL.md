---
name: vercel-deploy
description: >-
  Use when deploying the project to Vercel production: build and deploy the
  project to Vercel production with a verified healthcheck.
claudepilot:
  category: vercel
  requires:
    - vercel-env
  verification:
    kind: healthcheck
    description: Production responds 200.
    command: 'curl -fsS -o /dev/null -w ''%{http_code}'' {{prodUrl}}'
    expect: '200'
  tags:
    - vercel
    - deploy
    - launch
---

## Overview

Build and deploy the project to Vercel production with a verified healthcheck.

## Steps

1. Run `vercel deploy --prod` and capture the deployment URL.
2. Wait for the build to finish and the alias to be assigned.
3. Run a smoke check against a critical path.

## Verify

Curl the production URL and confirm a 200 status code before declaring the deploy healthy.

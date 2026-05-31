---
name: analytics-web-vitals
description: >-
  Use when you want to measure real-user performance (Core Web Vitals): measure
  and report Largest Contentful Paint, Interaction to Next Paint and Cumulative
  Layout Shift.
slipstream:
  category: analytics
  requires:
    - frontend-vite-react
  verification:
    kind: typecheck
    description: Web vitals code typechecks.
    command: 'pnpm --dir {{appName}} exec tsc --noEmit'
  tags:
    - analytics
    - performance
---

## Overview

Measure and report Largest Contentful Paint, Interaction to Next Paint and Cumulative Layout Shift.

## Steps

1. Install `web-vitals` and report each metric to your analytics endpoint.
2. Sample in production only to keep the data clean.
3. Set budgets and alert when a metric regresses.

## Verify

Typecheck the app and load it with web vitals enabled, confirming the three metrics are reported.

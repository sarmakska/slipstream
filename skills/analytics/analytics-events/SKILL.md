---
name: analytics-events
description: >-
  Track the handful of events that actually matter, such as sign up and
  purchase.
claudepilot:
  category: analytics
  requires:
    - analytics-plausible
  verification:
    kind: typecheck
    description: Event tracking code typechecks.
    command: 'pnpm --dir {{appName}} exec tsc --noEmit'
  tags:
    - analytics
---

## Overview

Track the handful of events that actually matter, such as sign up and purchase.

## Steps

1. Define a small typed set of event names so you do not track noise.
2. Fire events on sign up, checkout start and purchase completion.
3. Keep event payloads free of personal data.

## Verify

Typecheck the app and trigger a tracked action, confirming the event fires once with the expected name.

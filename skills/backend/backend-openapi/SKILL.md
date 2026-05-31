---
name: backend-openapi
description: >-
  Generate an OpenAPI specification from the API routes and serve it for
  consumers.
claudepilot:
  category: backend
  requires:
    - backend-zod-validation
  verification:
    kind: command
    description: The spec is valid JSON.
    command: >-
      node -e
      "JSON.parse(require('fs').readFileSync('{{apiDir}}/openapi.json','utf8'))"
  tags:
    - api
    - docs
---

## Overview

Generate an OpenAPI specification from the API routes and serve it for consumers.

## Steps

1. Derive request and response schemas from the existing Zod schemas.
2. Emit `openapi.json` and serve it at `/openapi.json`.
3. Link the document from the project README.

## Verify

Parse `openapi.json` to confirm it is valid JSON, then load it in an OpenAPI viewer to confirm routes appear.

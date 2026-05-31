---
name: context-budget
description: Use periodically during a long session to check the approximate context budget and decide whether to keep going, switch to scoped reads, or compact, so you rarely hit the context limit.
slipstream:
  category: context
  tags:
    - tokens
    - budget
---

## Overview

slipstream tracks an approximate context budget from the bytes pulled into context and converts it to a token estimate against the model window. This is honest guidance, not a guaranteed counter, but it lets you compact early rather than discovering the limit the hard way.

## Steps

1. Estimate the bytes you have read this session (file reads, slices, command output). A rough figure is fine.
2. Run `npx slipstream status . --bytes <bytes>` to see the budget level (`ok`, `warn` or `compact`) and its advice, alongside the project mind map.
3. Act on the level: at `ok` keep working; at `warn` switch firmly to scoped reads and start writing durable findings to memory; at `compact` run the `compact-and-offload` skill.

## Verify

Confirm the status output reports a budget level and that you have taken the recommended action for that level.

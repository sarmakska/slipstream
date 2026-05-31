---
name: scoped-read
description: Use before opening any source file in a project that has a claudepilot map, to read the compact index and pull a single symbol or line range instead of the whole file, protecting the context budget.
claudepilot:
  category: context
  tags:
    - tokens
    - retrieval
---

## Overview

The fastest way to run out of context is to read whole files. claudepilot gives you a compact map of files, exported symbols and purpose, plus two scoped retrieval helpers, so you read the index and one slice rather than everything.

## Steps

1. Ensure a fresh map exists: `npx claudepilot map . --md .claude/claudepilot/map.md`. Read that index.
2. Find the file and symbol you need from the map. Pull just that symbol with `npx claudepilot slice . <file> <symbol>`, or a known window with `npx claudepilot lines . <file> <start> <end>`.
3. Read a whole file only when a slice genuinely will not do (for example a small config). For anything large, slice first.

## Verify

Confirm you retrieved a scoped slice (a symbol or line range) rather than the whole file, and that the slice contains what you needed.

---
description: Build a compact project map so you read the index and one slice instead of whole files.
---

Refresh the slipstream project map and read it before opening any source file. This is the core of the token-efficiency pillar: the map is a few kilobytes even for a large repository, so reading it costs almost nothing, and it tells you exactly which file and symbol to pull.

## Steps

1. Run `npx slipstream map . --md .claude/slipstream/map.md --json .claude/slipstream/map.json` (the helper creates the `.claude/slipstream/` directory if needed).
2. Read `.claude/slipstream/map.md` to understand the file layout, entry points and exported symbols.
3. When you need the body of a specific symbol, run `npx slipstream slice . <file> <symbol>`. When you know the lines, run `npx slipstream lines . <file> <start> <end>`. Reach for a whole-file read only when a slice genuinely will not do.

## Verify

Confirm `.claude/slipstream/map.md` exists and lists the project files, then rely on it instead of reading whole files for the rest of the session.

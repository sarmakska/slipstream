---
name: memory-capture
description: Use when a durable decision, convention, architecture note, gotcha or credential location is established that should survive future sessions and compactions. Saves one fact per file to slipstream persistent memory.
slipstream:
  category: memory
  tags:
    - memory
    - persistence
---

## Overview

slipstream keeps long-term memory as one Markdown file per fact under `.claude/slipstream/memory/`, each with frontmatter (`name`, `description`, `type`, `tags`) and a single regenerated `MEMORY.md` index. This skill captures a durable fact so the next session and the next compaction do not lose it.

## Steps

1. Decide what is genuinely durable. Capture decisions, conventions, architecture, gotchas, credential locations and open todos. Do not capture transient state or anything you can re-derive cheaply from the project map.
2. Pick a `type`: `decision`, `convention`, `architecture`, `gotcha`, `credential-location`, `todo` or `fact`.
3. Write a one-line `description` that reads like the question that should surface this memory later (this is the recall text), and a short Markdown `body` with the fact.
4. Run `npx slipstream memory add --type <type> --desc "<description>" --body "<body>" --tags "<tags>" --root .`. The helper writes the file and regenerates `MEMORY.md`. Re-running with the same name updates the fact and preserves its created timestamp.

## Verify

Run `npx slipstream memory list --root .` and confirm the fact appears with the correct type and description, and that `.claude/slipstream/memory/MEMORY.md` lists it.

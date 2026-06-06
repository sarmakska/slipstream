---
name: using-slipstream
description: Use at the start of any session or task in a project that has slipstream, to begin memory-aware and end memory-rich. Recall what past sessions learned and read the project map before opening files, work deliberately, then record what is durable so the next session and the dashboard inherit it.
slipstream:
  category: context
  requires: []
  tags:
    - discipline
    - memory
    - orientation
---

## Overview

slipstream gives every session a memory that survives compaction and the next start, a scoped map of the codebase, and a local dashboard that records what was said and done. Those are only worth having if the agent actually uses them. This skill is the habit that closes the loop: open by recalling and orienting, work without re-reading whole files, and close by recording what is durable. Run it first in any slipstream project, before any other skill.

## Steps

1. Recall before reading. If the project has memory (`/slipstream:recall` or `npx slipstream memory recall --root .`), pull the relevant durable facts for the task at hand. Do not start from zero on something a past session already decided.
2. Read the map, not the files. Refresh and read `.claude/slipstream/map.md` (`/slipstream:map`) to find the symbols and line ranges you need, then pull single slices rather than whole files. This is the token discipline slipstream exists to enforce.
3. State the task in one line and the smallest change that satisfies it. Keep the edit surgical; do not refactor unrelated code.
4. Work in the open. Let the hooks record the session so the dashboard shows what you said and did. Prefer scoped reads so the optimisation tally stays honest.
5. Record what is durable. When the turn produces a decision, convention, gotcha or credential location, save it with `/slipstream:remember` so it survives the next compaction and shows up in the next session's recall.

## Verify

Confirm you recalled memory and read the map before the first file read, and that any durable outcome from the turn is saved (`npx slipstream memory list --root .` shows it). If nothing durable changed, that is a valid outcome; say so rather than inventing a memory.

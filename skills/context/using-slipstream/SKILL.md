---
name: using-slipstream
description: Use whenever the user says "use slipstream", "use superpowers", or starts any task in a project that has slipstream. A hard, always-on discipline that forces scoped reads over whole-file reads to save tokens, recalls memory before acting, and records what is durable every turn so memory grows constantly.
slipstream:
  category: context
  requires: []
  tags:
    - discipline
    - memory
    - token-efficiency
---

## Overview

slipstream only saves tokens and builds memory if the agent actually uses it. The dashboard showing "0% optimised" means whole files were read instead of scoped slices: a failure, not a neutral state. This skill is a rigid discipline, not a suggestion. When the user invokes slipstream, follow every step. Do not read a whole file when a symbol or a line range will do. Do not finish a turn without recording what is durable.

## Steps

1. Recall first, always. Before reading any code, pull relevant durable facts and the last session's summary (`/slipstream:recall`). Never start from zero on something a past session already decided.
2. Read the map, never the whole file. Refresh and read `.claude/slipstream/map.md` (`/slipstream:map`), then pull exactly what you need with `sp_symbol` (one symbol) or `sp_lines` (one range). Reading an entire file when a slice would do is a defect; the optimisation tally must not stay at 0%.
3. Search scoped, not broad. Use `sp_search` over the map and `sp_search_memory` over past work before grepping the tree.
4. State the task in one line and make the smallest change that satisfies it. No unrelated refactors.
5. Record durable outcomes every turn. When the turn produces a decision, convention, gotcha or credential location, save it with `/slipstream:remember`. Memory should grow constantly, not only when asked.
6. Coordinate with other tabs. If the session-start context lists other open sessions, build on their work; do not duplicate or undo it.

## Verify

Confirm three things before claiming the turn is done: you recalled memory before the first read, you used scoped reads (`sp_symbol`/`sp_lines`) rather than whole-file reads so the optimisation tally moved above 0%, and any durable outcome is saved (`npx slipstream memory list --root .` shows it). If you read a whole file when a slice would have worked, say so and correct the habit.

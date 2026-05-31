---
name: memory-recall
description: Use at the start of a task or when a question touches a prior decision, to pull the most relevant durable facts from slipstream memory before acting, so past choices are reused rather than re-derived or contradicted.
slipstream:
  category: memory
  requires:
    - memory-capture
  tags:
    - memory
    - recall
---

## Overview

Recall ranks stored memories by their `description`, `tags` and `type` against your query, then returns only the winning bodies. You read the relevance logic, not every memory file, which keeps recall cheap even with hundreds of facts.

## Steps

1. Form a short query that describes the task or the question in front of you.
2. Run `npx slipstream memory recall "<query>" --root . --limit 5`.
3. Apply the returned facts. If a recalled fact is now wrong, update it with `memory-capture` (same name overwrites) or remove it with `memory-prune`.

## Verify

Confirm the recalled facts are consistent with the current task before relying on them, and that you have not duplicated or contradicted an existing decision.

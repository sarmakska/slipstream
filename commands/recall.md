---
description: Recall relevant durable facts from slipstream memory by relevance to a query.
argument-hint: "[topic or question]"
---

Pull the most relevant durable facts from slipstream memory before you act, so you reuse past decisions instead of re-deriving or contradicting them.

Query: $ARGUMENTS

## Steps

1. Run `npx slipstream memory recall "$ARGUMENTS" --root . --limit 5`. The helper ranks memories by their description, tags and type, then prints only the winning bodies, so you read the index logic, not every file.
2. Apply the recalled facts. If a recalled memory is now wrong, update it with `/slipstream:remember` (same name overwrites) or remove it with `/slipstream:forget`.

## Verify

Confirm the recalled facts are consistent with the task in front of you before you rely on them.

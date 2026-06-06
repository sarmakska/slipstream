---
name: requesting-code-review
description: Use when a feature or fix is complete and verified, before merging, to get a focused review. Prepares a tight diff and the context a reviewer needs so the review finds real problems instead of drowning in noise.
slipstream:
  category: context
  requires: []
  tags:
    - review
    - quality
    - collaboration
---

## Overview

A review is only as good as what you hand the reviewer. A sprawling diff with no context gets a rubber stamp; a focused diff with a clear ask gets real scrutiny. This skill prepares the request so the review is worth the time: scope the change, state what to look at hardest, and make the diff readable.

## Steps

1. Confirm the work is verified first. A review is not a substitute for running the tests; arrive with a green suite.
2. Scope the diff. Keep the change to one concern. If it has grown to several, split it so each can be reviewed on its own.
3. Write the ask: what the change does, why, and the two or three places you are least sure about. Point the reviewer at the risk, not just the lines.
4. Note how you verified it: the tests added, the commands run, the behaviour checked. The reviewer should not have to guess what is already proven.
5. Request the review (`/code-review`, a pull request, or a fresh reviewer agent) with that context attached.

## Verify

Confirm the diff is scoped to one concern, the suite is green, and the request names the specific areas of doubt. A review request without a stated risk is not ready.

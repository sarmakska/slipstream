---
name: finishing-a-branch
description: Use when implementation is complete and verified and the work needs to land, to choose how to integrate it. Walks the close-out from a clean green suite to a recorded memory of what changed, then merge, pull request or cleanup as the situation calls for.
slipstream:
  category: context
  requires: []
  tags:
    - git
    - workflow
    - completion
---

## Overview

Work is not finished when the code works; it is finished when it has landed cleanly and the next session knows it happened. The end of a branch is where good work gets lost: an un-run check, an undocumented decision, a branch left dangling. This skill closes the loop deliberately so nothing leaks.

## Steps

1. Verify once more on the final state. Run the full suite, the build and the lint on exactly what will land. A green run earlier in the branch does not count.
2. Record what is durable. Save any decision, convention or gotcha from the branch with `/slipstream:remember` so it survives into the next session and the dashboard.
3. Write the integration message: what changed and why, in the project's commit and pull-request style. Keep it honest about what is and is not covered.
4. Choose the landing: a direct merge for small, owned changes; a pull request where review or a paper trail is wanted; a clean delete if the branch was an experiment that should not land.
5. Clean up after landing: remove the merged branch, confirm the main line is green, and leave the tree in the state the next session expects.

## Verify

The final state passed the full checks, durable outcomes are recorded in memory, and the branch reached its chosen destination with the main line green afterwards.

---
name: test-driven-development
description: Use before writing or changing any feature or bugfix code, to drive the change with a failing test first. Red, green, refactor. The discipline that proves the code does what was asked and keeps it proven as the project grows.
slipstream:
  category: context
  requires: []
  tags:
    - testing
    - discipline
    - correctness
---

## Overview

Code written before a test tends to test nothing and prove nothing. Writing the test first forces you to state the behaviour in concrete terms, gives you a definition of done you cannot fudge, and leaves a regression guard behind for free. This is a rigid discipline: do not write implementation before a failing test exists, and do not claim the work is done until the test passes for the right reason.

## Steps

1. Pin the behaviour. Write one small test that asserts the exact outcome you want, using the project's test runner and conventions. Test behaviour, not implementation detail.
2. Run it and watch it fail. A test that passes before you write the code is testing the wrong thing or nothing. Read the failure message and confirm it fails for the reason you expect.
3. Write the minimal code to make it pass. No extra features, no speculative abstraction. Just enough to turn the test green.
4. Run the test and confirm it passes. If it does not, fix the code, not the test, unless the test itself was wrong.
5. Refactor with the test green. Tidy names and structure, re-running the test after each change so a regression shows immediately. Commit once green and clean.

## Verify

Run the project's test command and confirm the new test passes and the rest of the suite still passes. Paste the actual passing count. A claim of done without a green run is not done.

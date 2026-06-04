---
name: systematic-debugging
description: Use when a bug, test failure, or unexpected behaviour appears, to find the root cause before changing code instead of guessing fixes. A four-phase process that stops the hallucinated-fix loop and the token waste of trying patches at random.
slipstream:
  category: context
  requires: []
  tags:
    - debugging
    - discipline
    - token-efficiency
---

## Overview

The expensive failure mode in debugging is fixing a symptom you do not understand: you change a line, the error moves, you change another, and three turns later the budget is gone and the bug is still there. This skill enforces root-cause-first. You do not edit production code until you can explain why the bug happens. The cost is a little patience up front; the saving is the pile of speculative edits you never make.

Four phases, in order — do not skip ahead:

1. **Investigate.** Read the actual error, stack trace, and failing input. Reproduce it deterministically. State, in one sentence, the observed behaviour versus the expected behaviour. Use `sp_search` and `sp_symbol` to read the relevant code precisely rather than loading whole files.
2. **Instrument.** If the cause is not yet obvious, add targeted logging or assertions at the boundaries the data crosses, and run again to see the real values. Do not theorise in place of looking.
3. **Isolate.** Narrow to the smallest reproduction. Confirm the one thing that, when changed, makes the bug appear and disappear. This is the root cause; name it explicitly.
4. **Fix.** Only now change code, and change only what the root cause requires. Remove the instrumentation you added. Then prove the fix.

## Steps

1. Reproduce the failure deterministically and write the observed-vs-expected in one line.
2. Read the implicated code with scoped retrieval; form a hypothesis about the cause.
3. If the cause is not certain, instrument the boundaries and re-run to see real values; revise the hypothesis until it is confirmed.
4. Isolate the minimal reproduction and name the root cause out loud.
5. Apply the smallest fix that addresses the root cause, remove instrumentation, and run the failing case plus the surrounding tests.

## Verify

The previously failing case now passes, the tests around it still pass, and you can state in one sentence why the bug happened and why the fix addresses that cause. A fix you cannot explain is not verified — keep going.

---
name: verification-before-completion
description: Use before claiming any work is done, fixed, passing or shipped, and before committing or opening a pull request. Requires running the real checks and quoting the real output, so a success claim is backed by evidence rather than hope.
slipstream:
  category: context
  requires: []
  tags:
    - discipline
    - correctness
    - honesty
---

## Overview

The most expensive failure is a confident "done" that was never checked. It sends the next person, or the next session, down a path built on a false floor. This skill is a hard gate: before any completion claim, run the checks that would catch you being wrong, read the output, and only then make the claim, quoting what you saw. Evidence before assertion, every time.

## Steps

1. List what "done" means for this change: the tests that should pass, the build that should be clean, the behaviour that should hold.
2. Run each check for real. Tests, type check, lint, build, and where it matters a quick manual smoke of the actual behaviour. Do not reason about what the result would probably be.
3. Read the output. Confirm the counts, the exit status and the absence of errors. A command that ran is not the same as a command that passed.
4. If anything failed, the work is not done. Fix it and re-run from step 2. Do not narrate around a failure.
5. State the outcome with the evidence: the passing count, the clean build line, the observed behaviour. Then, and only then, commit or open the pull request.

## Verify

The completion claim must be accompanied by the actual command output that supports it. If you cannot quote a green result, you cannot claim done.

---
name: receiving-code-review
description: Use when acting on code-review feedback, especially when a comment seems unclear or wrong. Requires verifying each point technically before changing anything, so you fix real issues and push back on mistaken ones instead of agreeing performatively.
slipstream:
  category: context
  requires: []
  tags:
    - review
    - quality
    - rigour
---

## Overview

Review feedback is input, not instruction. Acting on every comment without thought ships the reviewer's mistakes alongside your own and trains you to stop thinking. This skill keeps the bar high: treat each comment as a claim to verify, fix what is genuinely wrong, and disagree with reasons where the comment is mistaken. Agreement should be earned, not reflexive.

## Steps

1. Read each comment as a claim, not a command. Restate what it is actually asserting.
2. Verify it against the code. Reproduce the concern, read the relevant lines, or write a quick test. Decide whether it is right, partly right, or wrong.
3. For valid points, fix the underlying issue, not just the symptom the reviewer happened to spot. Re-run the checks after each fix.
4. For mistaken points, reply with the specific reason and evidence rather than silently complying or silently ignoring. A correct disagreement is a service to the reviewer.
5. When uncertain, ask a sharpening question rather than guessing at intent. Resolve the ambiguity before editing.

## Verify

Every comment is resolved with either a fix backed by a passing check or a reasoned reply. No change was made purely to look agreeable, and the suite is green after the fixes.

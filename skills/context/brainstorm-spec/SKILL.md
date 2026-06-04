---
name: brainstorm-spec
description: Use at the start of a non-trivial feature or change, before planning or coding, to refine a vague request into a short written spec through focused questions. Turns "build me X" into an agreed scope, so the plan and the code that follow do not chase a moving target.
slipstream:
  category: context
  requires: []
  tags:
    - planning
    - design
    - discipline
---

## Overview

A vague request coded straight away is the most expensive kind of work: you build the wrong thing, the user corrects you, and the budget pays for both versions. Brainstorming first is cheap insurance. The goal is a short spec both you and the user agree on, reached by asking the few questions that actually change the design rather than starting to type.

Keep it Socratic and bounded: ask only questions whose answers would change what you build, present real options with trade-offs, and stop as soon as the scope is clear. Then write the spec down so it survives compaction — save it as a slipstream memory and, for larger work, as a dated file under `docs/specs/`.

## Steps

1. Restate the request in your own words and identify the genuinely open decisions (scope, data shape, edge cases, non-goals).
2. Ask the user 2–5 focused questions, each with concrete options and their trade-offs. Skip anything you can reasonably default.
3. Draft a short spec: the goal in one line, what is in scope, what is explicitly out of scope, the key decisions made, and the success criteria.
4. Confirm the spec with the user; adjust until they agree.
5. Persist it: `sp_remember` the decisions (type `decision`), and for larger features save the spec to `docs/specs/<short-name>.md` so the next session and any plan build on it.

## Verify

A written spec exists with a one-line goal, explicit in-scope and out-of-scope lists, and success criteria the user has agreed to, and the durable decisions are saved to memory (`npx slipstream memory list --root .` shows them). If scope is still ambiguous, do not advance to planning or coding.

---
name: writing-skills
description: Use when creating or editing a slipstream skill, to produce one that loads cleanly and earns its place. Covers the frontmatter contract, the trigger-shaped description, the required body sections and the verification gate, so the skill validator passes and the skill is actually useful.
slipstream:
  category: context
  requires: []
  tags:
    - meta
    - authoring
    - quality
---

## Overview

A skill is a reusable piece of judgement the agent loads when it is relevant. A weak skill is worse than none: it adds noise and trains the agent to ignore skills. This meta-skill is how to write one that loads cleanly, fires at the right moment and changes behaviour. It encodes slipstream's own contract so a new skill passes the validator on the first try.

## Steps

1. Name it in kebab case and put `SKILL.md` in a directory of the same name under the right category folder. The directory name must match the `name` in the frontmatter.
2. Write the description as a trigger, not a label. Start with "Use when ..." and name the situation that should surface the skill, because that text is what the agent matches against.
3. Pick the category. Building categories (backend, auth, payments and the like) require a `slipstream.verification` gate with a real command. The memory and context categories are gateless because they are about discipline, not a deployable artifact.
4. Write the body with the required `## Steps` and `## Verify` sections, plus an optional `## Overview`. Steps are small and concrete; Verify states how to prove the skill worked.
5. Keep `requires` pointing only at skills that really exist, since the loader checks every dependency.

## Verify

Run `npx slipstream validate` and confirm the skill loads with no issues, the directory matches the name, the required sections are present and any non-gateless category carries a verification gate.

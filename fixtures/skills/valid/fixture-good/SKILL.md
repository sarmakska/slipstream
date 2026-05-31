---
name: fixture-good
description: A minimal but complete skill used to prove the loader accepts valid Claude Code SKILL.md input.
claudepilot:
  category: frontend
  verification:
    kind: typecheck
    description: TypeScript reports no errors.
    command: pnpm typecheck
  tags:
    - fixture
---

## Steps

1. Create the project structure.
2. Install dependencies.

## Verify

Run the typecheck and confirm a clean exit.

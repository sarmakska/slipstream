# Memory system

claudepilot gives Claude a persistent, structured memory so durable facts survive across sessions and compactions, and Claude does not re-read the whole codebase to remember a decision it made yesterday.

## On disk

Memory lives under your project at `.claude/claudepilot/memory/`:

- One Markdown file per fact, named after the memory, with frontmatter and a body.
- A single `MEMORY.md` index, regenerated from the files, so the files are always the source of truth and the index can never drift.

A memory file looks like this:

```markdown
---
name: we-deploy-to-cloudflare-pages
description: Where and how this project deploys to production
type: decision
tags:
  - deploy
  - cloudflare
created: 2026-05-31T12:00:00.000Z
updated: 2026-05-31T12:00:00.000Z
---

Production is Cloudflare Pages with a Worker for the API. Vercel was rejected
because the edge runtime here is Cloudflare specific.
```

The `description` is the recall text: write it as the question that should surface this memory later. The `type` is one of `decision`, `convention`, `architecture`, `gotcha`, `credential-location`, `todo` or `fact`.

## The lifecycle, driven by hooks and skills

- At session start, the `SessionStart` hook (`hooks/session-start.mjs`) reads `MEMORY.md` and injects it into the session, so Claude opens with the project's durable facts loaded, for the price of the index alone.
- During work, the `memory-recall` skill (or `/claudepilot:recall`) ranks memories by their description, tags and type against a query and returns only the winning bodies. You read the relevance logic, not every file.
- After meaningful work, the `Stop` hook (`hooks/stop.mjs`) occasionally reminds Claude to persist anything durable with `/claudepilot:remember`, so knowledge is captured before the next compaction.
- When something becomes wrong, `memory-prune` (or `/claudepilot:forget`) removes it, because a wrong durable fact is worse than no fact.

## The helper commands

```
npx claudepilot memory add --type decision --desc "Where we deploy" --body "Cloudflare Pages." --tags "deploy,cloudflare" --root .
npx claudepilot memory recall "deploy target" --root .
npx claudepilot memory list --root .
npx claudepilot memory prune we-deploy-to-cloudflare-pages --root .
npx claudepilot memory index --root .
```

`addMemory` derives a kebab name from the description if you do not pass one, stamps `created` and `updated`, and preserves the original `created` when you overwrite a memory of the same name. Every write regenerates `MEMORY.md`.

## How recall ranks

`recallMemories` in `src/memory/store.ts` scores each memory against the query terms: a name hit scores highest, then a tag hit, then a description hit, then a looser match anywhere in the frontmatter. It returns the top results, so recall stays fast and relevant even with hundreds of memories.

## Failure modes

- Recall returns nothing. The query shares no terms with any memory's description or tags. Rephrase, or list everything with `memory list`.
- Two memories say contradictory things. Prune or update the stale one. Keeping memory clean is part of the discipline.
- The index looks out of date. Run `node dist/cli/index.js memory index --root .` to regenerate it from the files.

## How recall and compaction build on the store

Two features sit on top of this store. [Memory recall](Memory-Recall) (`src/memory/recall.ts`) ranks memories against a task signal and reloads only the relevant subset at session start, never the whole store. [Lossless compaction](Lossless-Compaction) (`src/memory/digest.ts`) writes a structured session digest to the store before Claude Code compacts, and the next session reloads it first.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)

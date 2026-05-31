---
description: Show plan, progress, context budget and the project mind map in the chat.
argument-hint: "[approx bytes read this session]"
---

Render a live claudepilot status panel in the chat: project size, an approximate context budget with a recommendation, the number of stored memories, and the project mind map. Use it to decide whether to keep going or to compact.

## Steps

1. Run `npx claudepilot status . --bytes $ARGUMENTS` (pass your rough bytes-read estimate for this session, or omit it for a structure-only view).
2. Present the output: file and symbol counts, the context budget level (`ok`, `warn` or `compact`) with its advice, the memory count, and the Mermaid mind map.
3. If the budget level is `compact`, run the `compact-and-offload` skill: summarise the session, save durable facts with `/claudepilot:remember`, then compact.

## Verify

Confirm the status block reports a budget level and renders the mind map Mermaid diagram.

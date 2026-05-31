# Design decisions

The choices I made deliberately, and the alternatives I turned down. This is the page to read if you want to know why slipstream is shaped the way it is.

## A hand-rolled MCP server, not the SDK

The bundled MCP server (`src/mcp/server.ts`) is a small JSON-RPC-over-stdio loop, not a dependency on `@modelcontextprotocol/sdk`.

**Why.** The slice of the protocol Claude Code actually drives is tiny and stable: `initialize`, `tools/list`, `tools/call`, plus `ping` and the `initialized` notification. A plugin that bundles a server should add as little as possible to a user's install. Implementing the framing directly keeps runtime dependencies on the MCP path at zero and the whole server auditable in one file.

**Rejected.** Depending on the SDK would have pulled a tree onto the MCP path for behaviour I can write in fifty lines. **Cost of my choice.** I own the framing and the error codes. I pay for it with a pure, exported `handleRequest` the tests drive without a process, and a separate test that spawns the real binary over stdio to prove the transport works.

## Signal-ranked recall, not load-everything

`selectRelevant` (`src/memory/recall.ts`) reloads only the memories that match a task signal, under a token ceiling.

**Why.** The obvious memory design reloads the whole store every session. It gets more expensive the more useful the store becomes, which is backwards. Ranking against the branch, the changed files and the last prompt reloads the few facts that matter and leaves the rest in the index.

**Rejected.** A weighted sum over every memory with no ceiling (unbounded session-start cost), and embeddings (a model dependency and a vector store for a problem that frontmatter and a branch name already solve well). **Cost.** The ranking is heuristic, so a mistagged memory can be missed; the fix is a tag, which the ranking weights highly.

## A byte-count budget estimate, not a real token meter

`src/context/budget.ts` estimates tokens from bytes at a cautious 3.6 bytes per token.

**Why.** slipstream cannot read Claude Code's internal token counter. I would rather be honestly approximate and conservative (compact a little early) than precise-looking and wrong. The wording everywhere says "approximate".

**Rejected.** Pretending to a precise count I cannot obtain.

## Files for memory, not a database

One Markdown file per fact, with a regenerated index.

**Why.** Reviewable, diffable, survives without a running service, and the index is regenerated from the files so it can never drift. **Rejected.** SQLite: a native module that complicates packaging a plugin meant to install cleanly everywhere, for indexes a store this size does not need.

## Append-only JSONL for the event log, not a database

**Why.** Append-only by construction, tailable, human-readable, and replay is a pure fold over the lines. **Rejected.** SQLite again, for the same packaging reason. **Cost.** I do my own concurrency control with a small advisory lock (`src/dashboard/log.ts`) so two racing hook processes never pick the same sequence number; that path is tested under 25 parallel writers.

## Server-sent events on node:http, not a websocket on a framework

**Why.** Dashboard traffic is one-directional, server to browser, and SSE reconnects on its own over plain HTTP. **Rejected.** A websocket (a duplex channel I do not need) and Express (weight and a dependency that could break the plugin build). **Cost.** I hand-write a tiny router.

## A heuristic line scan for the map, not a full parser

**Why.** The agent uses the map to decide where to look, then reads the real slice, so a perfect AST would be cost without payoff. **Rejected.** Wiring in the TypeScript compiler API: it would couple the map to one language and pay a parse tax on every regeneration for accuracy the agent does not need.

## The helper owns only the objective parts

Indexing, retrieval, budget, validation, event recording, the MCP transport. The judgement (what to remember, when to compact, whether a gate is the right one) stays with the agent following the skills. slipstream is a set of disciplines and tools, not an autopilot.

## See also

- [Architecture](Architecture) for how these fit together.
- [MCP tools](MCP-Tools), [Memory recall](Memory-Recall), [Live agent dashboard](Live-Agent-Dashboard) for the features each decision serves.
- [Comparisons](Comparisons) for how these choices differ from the alternatives.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/slipstream)

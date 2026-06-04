# Testing strategy

The suite is 120 tests across 13 files, run with `pnpm test` (Vitest). It runs in about 1.6 s. The strategy is to test the pure cores directly and to spawn the real processes where a process boundary is the thing that could break.

## What each file covers

| File | Covers |
|---|---|
| `tests/map.test.ts` | symbol extraction, map generation, that the map embeds no contents, scoped retrieval returns one symbol not the file, line ranges, search ranking, the mind map |
| `tests/memory.test.ts` | normalise, add/list, preserve created timestamp on overwrite, update, prune, recall ranking from frontmatter, index rendering |
| `tests/recall.test.ts` | signal ranking by branch, by changed files, by prompt; empty-signal returns nothing; the token-budget ceiling over a 50-memory store; render |
| `tests/memory-search.test.ts` | the local embedding (unit length, determinism, related-above-unrelated cosine, camel/snake tokenising); `foldObservations` turning turns into observations and leaving open turns unconsumed; idempotent capture with project-wide ids; the three-layer search (index ranking, kind filter, timeline anchor, exact-term beats merely-similar) |
| `tests/cross-ide.test.ts` | budget config load/save/sanitise and percentage→fraction conversion; the MCP session id derived from the client; true context size from a transcript's latest usage block; the optimization tally; lesson distillation (recurring topic across sessions, min-count filter, ignoring structural path segments) |
| `tests/digest.test.ts` | digest build (open task, decisions, files, next step), markdown render, and the lossless property: write a digest, reload it on a stripe branch with the decision intact |
| `tests/mcp.test.ts` | the pure `handleRequest` (initialize, tools/list, notification, method-not-found), `sp_symbol` returns a slice shorter than the file, `sp_map`/`sp_search` embed no bodies, and a spawned real server answering `tools/list` and a `sp_symbol` call over stdio |
| `tests/statusline.test.ts` | the exact formatted line for fixed inputs, dropped empty segments, the warn and COMPACT thresholds |
| `tests/doctor.test.ts` | doctor passes against the real tree, surfaces the MCP/PreCompact/subagent/statusline checks, renders pass/fail, and fails loudly on a deliberately broken install |
| `tests/context.test.ts` | token estimate, budget levels, the read guard |
| `tests/engine.test.ts` | the skill schema and loader, gate enforcement, duplicate and unknown-requires detection |
| `tests/plugin-validate.test.ts` | the whole plugin validates: manifest, MCP declaration, statusline, marketplace, all seven hooks, commands, agents, output style, 63 skills |
| `tests/dashboard.test.ts` | event validity, the concurrency-safe append-only writer under 25 parallel writers, a real SSE server end to end, idempotent start, replay |

## The two principles

**Test the pure core directly.** `handleRequest`, `formatStatusline`, `rankBySignal`, `buildDigest`, `budget`, `mapToMarkdown` and the event reducer are all pure. Pinning their output is fast and exact, which is why the suite runs in seconds.

**Spawn the real process at a real boundary.** The MCP transport and the dashboard server are where a process boundary could fail in a way a unit test would miss, so those tests spawn the actual binary: the MCP test writes JSON-RPC to a child's stdin and reads framed responses from its stdout; the dashboard test stands up a real `node:http` server on a free port and streams an event end to end.

## The headline assertions

- `sp_symbol` must not return the whole file. The MCP test asserts the slice is strictly shorter than the file and excludes a later unrelated declaration.
- A compaction digest must survive. The digest test writes a digest and reloads it via the same `selectRelevant` the session-start hook uses, asserting the open task and a decision come back.
- Recall must stay bounded. The recall test builds 50 memories and asserts the reloaded subset stays under the token ceiling and is smaller than the store.
- The install must be verifiable. The doctor test runs against a broken tree and asserts the right checks turn `FAIL`.

## Running it

```
pnpm install --frozen-lockfile
pnpm build        # the MCP and doctor tests use dist/
pnpm test
```

The MCP stdio test and the doctor test both need `dist/` built, because they exercise the compiled binary; `pnpm build` before `pnpm test` covers them.

## See also

- [Performance and benchmarks](Performance-and-Benchmarks) for the timings.
- [Contributing](Contributing) for adding a test with a new feature.
- [MCP tools](MCP-Tools) and [Lossless compaction](Lossless-Compaction) for the features under test.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/slipstream)

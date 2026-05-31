# Token efficiency

The fastest way to run a Claude Code session into the ground is to read whole files until the context window is full. claudepilot is built so you rarely hit that wall. This is honest guidance backed by the MCP tools, hooks and a budget estimate, not a literal guarantee.

## The worked before/after numbers

These are real, measured on this machine (Apple Silicon, Node 25) by running the helper on this repository. The token figures use claudepilot's own conservative 3.6 bytes-per-token estimate (`src/context/budget.ts`).

A task that needs the body of `retrieveSymbol` in `src/map/retrieve.ts`:

```
$ wc -c src/map/retrieve.ts
    4841 src/map/retrieve.ts                                   # whole file
$ node dist/cli/index.js slice . src/map/retrieve.ts retrieveSymbol | wc -c
    1381                                                       # cp_symbol slice
```

| Approach | Bytes into context | Approx tokens | Saving |
|---|---|---|---|
| Whole-file `Read` of `retrieve.ts` | 4,841 | ~1,345 | baseline |
| `cp_symbol(retrieve.ts, retrieveSymbol)` | 1,381 | ~384 | **71% fewer** |

The gap widens with file size. Orienting in the whole `src/` tree by reading every file is about 40,597 tokens (146,150 bytes). Reading the `cp_map` index instead is about 2,173 tokens (7,821 bytes), **5.4% of reading everything**. So the first move of every session, orienting in the codebase, costs roughly one twentieth of what reading the files would.

## The MCP tools are the front door

The bundled MCP server (`src/mcp`) exposes the map and scoped retrieval as tools Claude calls directly: `cp_map`, `cp_symbol`, `cp_lines`, `cp_search`. A single `cp_symbol` call replaces a whole-file `Read`. See [MCP tools](MCP-Tools) for the full surface and the discipline that keeps each result minimal.

## The project map

`src/map/generate.ts` produces a compact index of the project: for every source file, its path, a one-line purpose, the exported symbols with their kind and line, the imports, and the size in bytes and lines. It never embeds file contents, so the map stays a few kilobytes even for a large repository.

Build or refresh it with `/claudepilot:map`, which runs:

```
npx claudepilot map . --md .claude/claudepilot/map.md --json .claude/claudepilot/map.json
```

Read `.claude/claudepilot/map.md` once and you know the shape of the codebase for the price of a few kilobytes.

## Scoped retrieval

Once the map tells you which file and symbol you need, pull only that:

- By symbol: `npx claudepilot slice . src/app/auth.ts createSession`. `retrieveSymbol` finds the declaration line from the map, walks braces to find its end, captures any leading doc comment, and returns just that span.
- By line range: `npx claudepilot lines . src/app/auth.ts 40 80`. `retrieveLines` returns exactly that window, clamped to the file.
- By query: `npx claudepilot map . --search "session cookie"` ranks files by relevance using `searchMap`, without reading any file body.

A slice is one declaration. A whole-file read of a large module can be thousands of tokens. The discipline is: read the map, then slice.

## The read-the-map discipline, enforced by hooks

Two hooks keep the discipline without you having to remember it.

- `PreToolUse` on the `Read` tool (`hooks/pre-tool-use.mjs`) inspects the file Claude is about to read. If it is larger than the large-file threshold (16 KB, matching `LARGE_FILE_BYTES`) and the read is a whole-file read (no offset or limit), it injects a note with the approximate token cost and points at scoped retrieval. It allows the read; it does not block, because some whole-file reads are legitimate.
- `UserPromptSubmit` (`hooks/user-prompt-submit.mjs`) reminds Claude, on each new prompt, to recall relevant memory and to use the map and slices, but only when a map already exists, so it does not nag on a fresh checkout.

## Context budgeting and compaction

`src/context/budget.ts` turns a byte count into a budget. `estimateTokens` uses a cautious bytes-per-token ratio (3.6). `budget` compares the estimate against the model window and returns a level:

- `ok` below 60 percent: keep reading the map and slicing.
- `warn` between 60 and 85 percent: switch firmly to slices and start writing durable findings to memory.
- `compact` above 85 percent: run the `compact-and-offload` skill, then compact.

See it with `/claudepilot:status` (pass `--bytes <your estimate>`). The `compact-and-offload` skill summarises the session and pushes durable facts into memory before you compact, so the next stretch of work resumes from the index rather than the old transcript.

## Failure modes

- The map is stale after big changes. Re-run `/claudepilot:map`. The map is a snapshot; regenerate it when the structure changes.
- A slice returns too little or too much. The brace walker is heuristic. Fall back to `lines` with an explicit range, or widen the range.
- The budget says `ok` but you still feel tight. The estimate counts bytes you pull through the helper; it cannot see everything Claude Code holds. Treat it as a floor, and compact early.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)

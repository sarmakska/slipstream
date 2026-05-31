# Token efficiency

The fastest way to run a Claude Code session into the ground is to read whole files until the context window is full. claudepilot is built so you rarely hit that wall. This is honest guidance backed by hooks and a budget estimate, not a literal guarantee.

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

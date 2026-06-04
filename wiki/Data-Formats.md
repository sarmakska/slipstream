# Data formats

Every file slipstream reads or writes is plain text you can open, diff and understand. This page documents the exact shapes, with the source of truth for each.

## The project map (`map.json`)

Defined by `ProjectMap` in `src/map/types.ts`:

```jsonc
{
  "version": 1,
  "root": "/abs/path/to/project",
  "generatedAt": "2026-05-31T20:00:00.000Z",
  "entryPoints": ["src/index.ts", "src/cli.ts"],
  "files": [
    {
      "path": "src/greet.ts",          // relative, forward-slashed
      "purpose": "Greeting helpers",    // first leading comment or a heuristic
      "symbols": [
        { "name": "greet", "kind": "function", "line": 10 }
      ],
      "imports": ["./util.js"],
      "bytes": 512,
      "lines": 24
    }
  ],
  "stats": { "fileCount": 59, "symbolCount": 158, "totalBytes": 211926 }
}
```

`SymbolKind` is one of `function`, `class`, `interface`, `type`, `const`, `enum`, `component`, `default`. The map never contains file contents. `map.md` is the same data rendered as a directory-grouped Markdown index by `mapToMarkdown`.

## A scoped slice (`SymbolSlice`)

What `sp_symbol` and `sp_lines` return, defined in `src/map/types.ts`:

```jsonc
{
  "path": "src/greet.ts",
  "symbol": "greet",
  "kind": "function",
  "startLine": 10,
  "endLine": 20,
  "code": "export function greet(name: string) { ... }"
}
```

## A memory file

One Markdown file per fact under `.claude/slipstream/memory/<name>.md`, with YAML frontmatter (`MemoryFrontmatter` in `src/memory/types.ts`):

```markdown
---
name: supabase-rls-default-deny
description: Every table has RLS on and denies by default
type: gotcha
tags:
  - supabase
  - rls
created: 2026-05-31T20:00:00.000Z
updated: 2026-05-31T20:00:00.000Z
---

A table with RLS enabled and no policy denies all access.
```

`type` is one of `decision`, `convention`, `architecture`, `gotcha`, `credential-location`, `todo`, `fact`. The `MEMORY.md` index is generated from the files (grouped by type), so the files are the source of truth and the index can never silently drift.

## A session digest

A digest is a memory of type `todo` named `session-digest-<session>`, tagged `session-digest`, `compaction` and the file stems it touched. Its body (from `digestToMarkdown`):

```markdown
Compaction digest for session sess-123, auto trigger, taken 2026-05-31T20:00:00.000Z.

**Open task:** Wire the Stripe webhook handler and verify signatures

**Decisions made:**
- decided to use the raw request body for webhook verification because the parsed body breaks the signature

**Files touched:**
- src/payments/webhook.ts

**Next steps:**
- Continue from: edited src/payments/webhook.ts
```

## The event log (`<session>.jsonl`)

One JSON event per line, append-only (`DashboardEvent` in `src/dashboard/events.ts`):

```jsonc
{"seq":0,"ts":"2026-05-31T20:00:00.000Z","session":"main","agent":"main","kind":"session-start","label":"session started"}
{"seq":1,"ts":"2026-05-31T20:00:01.000Z","session":"main","agent":"main","kind":"pre-tool","label":"Read src/greet.ts"}
{"seq":2,"ts":"2026-05-31T20:00:01.500Z","session":"main","agent":"main","kind":"post-tool","label":"read 512 bytes","data":{"bytes":512}}
```

`kind` is one of `session-start`, `user-prompt`, `pre-tool`, `post-tool`, `subagent-start`, `subagent-stop`, `stop`. `seq` is assigned by the writer under a small advisory lock so two racing hooks never collide. Labels and payloads are redacted before they reach disk (see [Security model](Security-Model)). Dashboard state is a pure fold over these lines, which is what makes replay free.

## An observation (`observations/<session>.jsonl`)

One JSON record per line, append-only (`Observation` in `src/memory/observe.ts`), folded from the event log by `captureObservations`:

```jsonc
{
  "id": 1,                         // project-wide monotonic; the citation handle
  "session": "main",
  "ts": "2026-06-04T10:02:00.000Z",
  "kind": "edit",                  // edit | read | command | search | prompt | note
  "summary": "fix the stripe webhook signature verification — Read, Edit (1 file)",
  "detail": "Request: ...\nTools: Read, Edit\nFiles:\n  - src/payments/webhook.ts",
  "files": ["src/payments/webhook.ts"],
  "tags": ["edit", "webhook", "read"],
  "vector": [0.0, 0.13241, -0.08812, /* … 256 floats, the local embedding */]
}
```

`kind` is the dominant activity of the turn. `vector` is a unit-length 256-float hashed term-frequency embedding (`src/memory/embed.ts`), rounded to five decimals so the file stays compact without changing cosine ranking. A sibling `<session>.cursor` file records the last event seq folded into observations, so capture is incremental; a project-wide `.counter` file holds the next id. See [Observation memory and semantic search](Observation-Memory).

## The optimization ledger (`savings.jsonl`)

One append-only line per scoped read (`SavingRecord` in `src/context/savings.ts`), recording what slipstream served against the whole-file baseline it replaced:

```jsonc
{"ts":"2026-06-04T10:00:00.000Z","tool":"sp_symbol","file":"src/greet.ts","servedBytes":300,"fullBytes":556}
```

`loadSavings` totals the lines and `summarizeSavings` turns the tally into saved tokens and the percentage trimmed, surfaced by `sp_savings`, `slipstream savings`, the `opt %` statusline segment and the dashboard. Exact in any editor, since it derives only from slipstream's own calls.

## budget.json

The editable token-budget control (`BudgetConfig` in `src/context/budget-config.ts`), read by the dashboard gauge, `sp_budget` and the statusline so they agree:

```jsonc
{
  "targetTokens": 200000,  // the target the gauge fills toward
  "warnPct": 60,           // amber threshold, percent of target
  "compactPct": 85,        // red threshold, percent of target
  "actualTokens": 0        // optional real count pasted from the editor, to calibrate
}
```

Thresholds are clamped to a sane ordered range on save (compact always above warn). The gauge measures context slipstream pulled in, an estimate, not the model's true tokens.

## server.json

```jsonc
{ "pid": 53267, "port": 53267, "url": "http://127.0.0.1:53267", "startedAt": "..." }
```

Records the running dashboard so a second SessionStart reuses it rather than spawning a duplicate.

## See also

- [Architecture](Architecture) for the modules that produce these.
- [Configuration and tuning](Configuration-and-Tuning) for where they live.
- [Memory system](Memory-System) for the store lifecycle.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/slipstream)

# Cross-client memory

## The problem

You work out something worth keeping — why a migration has to run in that order, which
API lies about its rate limit, the reason a config looks wrong but is not — and it is
recorded in whichever tool you happened to be using. Open a different client tomorrow and
that reasoning is gone. The knowledge was never about the client; it was about the
project. Filing it per-tool was always the wrong shape.

slipstream stores memory **per project, not per client**. The store lives at
`.claude/slipstream/` inside the repo, so every tool pointed at that repo reads and writes
the same memories.

Two routes get a conversation in there. They solve different halves of the problem and you
generally want both.

---

## Route 1 — live, via MCP

slipstream is an MCP server. Register it in any MCP-capable client and that client writes
to the project store directly, as the work happens.

```jsonc
{
  "mcpServers": {
    "slipstream": {
      "command": "node",
      "args": ["<path>/slipstream/dist/mcp/index.js"]
    }
  }
}
```

The agent then calls `sp_remember` when it settles something durable, and `sp_recall` at
the start of a task to pull back what was already decided. Nothing is scraped, nothing is
guessed, and the memory carries the reasoning because the model wrote it while holding the
context.

**This is the route that works everywhere**, including clients whose local history is
inaccessible. It is the one to reach for first.

---

## Route 2 — harvest, after the fact

Route 1 only captures what an agent thought to write down, and only in clients you have
wired up. Harvesting fills the gap: it reads transcripts that clients have already written
to disk and folds them into the same store, so the raw conversation is searchable even
when nobody called `sp_remember`.

```bash
slipstream harvest sources     # what this machine actually has
slipstream harvest --dry-run   # what would be folded
slipstream harvest             # fold it
```

Idempotent by construction: a transcript is re-read only when its size or mtime has moved,
so running it on a timer costs one `stat` per file. A chat still in progress is re-read
each run and its stored copy replaced — a conversation is not finished until it is.

Useful flags: `--source claude-code,codex` to restrict, `--since 2026-01-01` to ignore old
history, `--root .` to target a project other than the working directory.

### Supported sources

| Client | Location | Status |
|---|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` | Full — JSONL, documented shape |
| Codex CLI | `~/.codex/sessions/**/rollout-*.jsonl` | Full — messages plus `function_call` / `custom_tool_call` names |

Both parsers are pure over their raw text and unit-tested against real transcript shapes.
Injected system prompts (Codex's `developer` role) are dropped; they are not conversation.

### Clients that cannot be harvested, and why

**Antigravity** keeps conversation state in `~/.gemini/antigravity/implicit/*.pb`. Those
files are encrypted at rest — roughly 50% high bytes, no gzip or zlib magic, and not one
printable run of 24 characters or more in a 300 KB file. There is no schema to write an
adapter against and no key to read them with.

**Claude Desktop** and the VS Code forks that keep chats in a `state.vscdb` SQLite blob are
in the same position to varying degrees.

No adapter is shipped for these, deliberately. A scraper that silently produced nothing
would be worse than an honest gap: you would believe your history was being captured while
it quietly was not. Use Route 1 for these clients — it works, and it captures better
material anyway.

If a client's format is documented and readable, adding it is one adapter in
`src/memory/sources.ts`: say where the files are, list them, parse one into
`TranscriptTurn[]`. Everything downstream is shared.

---

## Running it on a schedule

Harvesting is cheap enough to run often. Every ten minutes is reasonable; hourly is plenty.

**macOS / Linux** — cron:

```cron
*/10 * * * * cd /path/to/repo && slipstream harvest >/dev/null 2>&1
```

**Windows** — Task Scheduler:

```powershell
$action  = New-ScheduledTaskAction -Execute "slipstream" -Argument "harvest --root C:\path\to\repo"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
             -RepetitionInterval (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName "slipstream-harvest" -Action $action -Trigger $trigger
```

---

## What harvesting deliberately does not do

It does not decide which conversations mattered. Folding a transcript is cheap and
lossless; judging significance is recall's job, and doing it at capture time would throw
away context that cannot be recovered. Harvest takes everything readable and lets
`sp_recall` and `sp_search` do the selecting.

It also does not summarise with an LLM. The fold is deterministic — one human ask plus the
assistant work that followed it — so the same transcript always produces the same record,
and a harvest run costs nothing but disk.

---

## Where it lands

```
.claude/slipstream/
├── conversations/
│   ├── <session>.json              # Claude Code keeps its bare session id
│   └── codex--<session>.json       # other clients are namespaced
├── harvest-state.json              # size + mtime per file, drives the skip
└── memory/                         # durable memories, from either route
```

Conversations carry a `source` field naming the client they came from. Records folded
before sources existed have no `source` and are Claude Code by definition.

The whole directory is gitignored. It is local knowledge about a repo, not part of it.

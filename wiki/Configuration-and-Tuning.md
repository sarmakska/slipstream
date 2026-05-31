# Configuration and tuning

claudepilot works with zero configuration. Everything below has a sensible default; you only touch it to change behaviour deliberately.

## Dashboard settings

`.claude/claudepilot/dashboard.json` in your project (`src/dashboard/settings.ts`):

```jsonc
{
  "enabled": true,   // auto-start the local server on SessionStart
  "autoOpen": true   // open the browser on first start
}
```

Environment overrides, for a single session without editing the file:

| Variable | Effect |
|---|---|
| `CLAUDEPILOT_DASHBOARD=0` | disable the dashboard |
| `CLAUDEPILOT_DASHBOARD=1` | force enable |
| `CLAUDEPILOT_DASHBOARD_OPEN=0` | keep the browser shut |
| `CLAUDEPILOT_DASHBOARD_OPEN=1` | force open |

## Context budget

`src/context/budget.ts` holds the tunable constants:

| Constant | Default | Meaning |
|---|---|---|
| `BYTES_PER_TOKEN` | 3.6 | bytes-per-token estimate; lower is more cautious |
| `DEFAULT_WINDOW_TOKENS` | 200,000 | model context window |
| `COMFORT_FRACTION` | 0.6 | the share treated as comfortably usable (`ok` below this) |
| `LARGE_FILE_BYTES` | 16,000 | the threshold above which a whole-file read is flagged |

The window can be overridden per call: `cp_budget(bytesRead, windowTokens)` and `claudepilot budget --bytes N --window N`. The levels are `ok` below `COMFORT_FRACTION`, `warn` up to 85%, `compact` above.

## Recall budget

`src/memory/recall.ts`:

| Constant | Default | Meaning |
|---|---|---|
| `RECALL_TOKEN_BUDGET` | 1,200 | the ceiling on the relevant subset reloaded at session start |
| `WEIGHTS` | branch 4, tag 3, file 3, description 2, haystack 0.5 | the ranking weights |

Raise the budget to reload more at session start, at the cost of more tokens; lower it to reload less. The weights are tuned against this project's own store (see [Memory recall](Memory-Recall)).

## Digest bounds

`src/memory/digest.ts` bounds the digest so it stays a memory the next session can afford to reload: `MAX_DECISIONS` 8, `MAX_FILES` 20, `MAX_LINE` 200 characters.

## Statusline

The statusline reads the same budget constants. To change what it shows, edit `formatStatusline` in `src/statusline/index.ts` (it is pure and unit-tested, so a change is caught by the test). To enable it manually, see [Statusline](Statusline).

## Where state lives

claudepilot writes only under `.claude/claudepilot/` in your project:

```
.claude/claudepilot/
  map.md  map.json              # the project map (from /claudepilot:map)
  memory/                       # one .md per fact + MEMORY.md index
  dashboard/<session>.jsonl     # append-only event log per session
  dashboard/server.json         # the running server's pid/port/url
  dashboard.json                # optional settings
```

Add `.claude/claudepilot/` to `.gitignore` to keep it local, or commit `memory/` if you want the team to share durable facts.

## See also

- [Data formats](Data-Formats) for the exact shapes of these files.
- [Memory recall](Memory-Recall) for the recall tuning in context.
- [Security model](Security-Model) for what is written and what is redacted.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)

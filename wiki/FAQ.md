# FAQ

## Do I run slipstream as a CLI?

No. You install it as a Claude Code plugin in VS Code. There is a helper binary the plugin calls from its hooks, slash commands and the MCP server, but you never invoke it directly. The `node dist/cli/index.js ...` lines in the docs are for debugging and scripting.

## What does it actually save me tokens on?

Reads. Instead of opening a whole file, Claude calls `sp_symbol` for one declaration or `sp_lines` for a window. On this repository a single symbol is 71% fewer tokens than the whole file, and orienting via the map is 5.4% of reading the tree. See [Token efficiency](Token-Efficiency).

## Is the token budget real?

Inside Claude Code, yes: slipstream reads the session transcript's latest usage block for the true context-window occupancy and shows it marked exact (`ctx 47%*`). In an editor that exposes no readable transcript over MCP it falls back to a cautious estimate (bytes pulled at 3.6 bytes/token), which you can calibrate by pasting the editor's real number into `budget.json`'s `actualTokens`. Either way the gauge, the `sp_budget` tool and the statusline read the same `budget.json`. See [Cross-IDE support](Cross-IDE-Support) and [Configuration and tuning](Configuration-and-Tuning).

## How much has slipstream actually saved me?

Run `sp_savings` or `slipstream savings`, or read the "optimised" line in the dashboard's Session-work panel and the `opt %` statusline segment. Every scoped read records the bytes it served versus the whole-file baseline, so the figure ("saved ~N tokens, Y% less than whole-file reads") is exact — and works in every editor, not just Claude Code, because it is computed from slipstream's own calls. See [Token efficiency](Token-Efficiency).

## Does it remember what I did automatically?

Yes. Beyond the facts you save with `/slipstream:remember`, every turn is folded into a compact, semantically searchable observation. Query it with `sp_search_memory` → `sp_timeline` → `sp_observations`, and ask `sp_lessons` for the topics you keep returning to. See [Observation memory and semantic search](Observation-Memory).

## Does it work in Cursor, Windsurf, Antigravity or plain VS Code?

The MCP layer does: the `sp_*` tools, memory search, the live dashboard, the budget gauge and the optimization metric all work via the MCP server, which feeds and auto-starts the dashboard with no hooks. Skills, slash commands and the statusline are Claude Code plugin features. The true token count needs Claude Code's transcript; elsewhere the budget is an estimate. See [Cross-IDE support](Cross-IDE-Support).

## Does my code or my memory leave the machine?

No. There is no telemetry and no remote service. The dashboard binds `127.0.0.1` only, and obvious secrets are redacted before they reach the local log. See [Security model](Security-Model).

## What happens to my context when the session compacts?

The `PreCompact` hook writes a structured digest (open task, decisions, files touched, next step) to memory before the compaction. The next session reloads it first. That is the lossless-compaction feature. See [Lossless compaction](Lossless-Compaction).

## Does it reload my whole memory store every session?

No. It ranks memories against a task signal (git branch, changed files, last prompt) and reloads only the relevant subset under a ~1,200 token ceiling, plus the index. With no signal it reloads nothing. See [Memory recall](Memory-Recall).

## How do I know the install is working?

Run `/slipstream:doctor`. It checks the MCP server, every hook including PreCompact, the memory store, the CLI, the statusline, the output style and the subagents, and prints a `PASS`/`FAIL` line per check.

## Why not use the MCP SDK?

To keep the bundled server dependency-free and auditable in one file. The protocol surface Claude Code drives is small and stable. See [Design decisions](Design-Decisions).

## Can I add my own skills, tools or agents?

Yes. See [Writing a skill](Writing-a-Skill) and [Contributing](Contributing). The skill engine is general; the shipped catalogue is opinionated toward Cloudflare, Supabase, Vercel and Resend.

## Does the dashboard control the agents?

No. It observes and visualises them. It cannot pause a tool call or steer a subagent. That is by design. See [Live agent dashboard](Live-Agent-Dashboard).

## What Node version do I need?

Node 20 or newer, on the PATH Claude Code uses. The hooks, helper and MCP server all run on Node.

## Will there be a hosted version?

No. slipstream stays local-only. If it phoned home it would not be slipstream. See [Roadmap and limitations](Roadmap-and-Limitations).

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/slipstream)

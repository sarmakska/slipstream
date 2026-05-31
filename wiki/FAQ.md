# FAQ

## Do I run claudepilot as a CLI?

No. You install it as a Claude Code plugin in VS Code. There is a helper binary the plugin calls from its hooks, slash commands and the MCP server, but you never invoke it directly. The `node dist/cli/index.js ...` lines in the docs are for debugging and scripting.

## What does it actually save me tokens on?

Reads. Instead of opening a whole file, Claude calls `cp_symbol` for one declaration or `cp_lines` for a window. On this repository a single symbol is 71% fewer tokens than the whole file, and orienting via the map is 5.4% of reading the tree. See [Token efficiency](Token-Efficiency).

## Is the token budget real?

It is an honest estimate, not Claude Code's internal counter (which a plugin cannot read). It counts bytes pulled through the helper at a cautious 3.6 bytes per token and is tuned to warn early. Treat the percentage as a strong hint, not gospel. See [Configuration and tuning](Configuration-and-Tuning).

## Does my code or my memory leave the machine?

No. There is no telemetry and no remote service. The dashboard binds `127.0.0.1` only, and obvious secrets are redacted before they reach the local log. See [Security model](Security-Model).

## What happens to my context when the session compacts?

The `PreCompact` hook writes a structured digest (open task, decisions, files touched, next step) to memory before the compaction. The next session reloads it first. That is the lossless-compaction feature. See [Lossless compaction](Lossless-Compaction).

## Does it reload my whole memory store every session?

No. It ranks memories against a task signal (git branch, changed files, last prompt) and reloads only the relevant subset under a ~1,200 token ceiling, plus the index. With no signal it reloads nothing. See [Memory recall](Memory-Recall).

## How do I know the install is working?

Run `/claudepilot:doctor`. It checks the MCP server, every hook including PreCompact, the memory store, the CLI, the statusline, the output style and the subagents, and prints a `PASS`/`FAIL` line per check.

## Why not use the MCP SDK?

To keep the bundled server dependency-free and auditable in one file. The protocol surface Claude Code drives is small and stable. See [Design decisions](Design-Decisions).

## Can I add my own skills, tools or agents?

Yes. See [Writing a skill](Writing-a-Skill) and [Contributing](Contributing). The skill engine is general; the shipped catalogue is opinionated toward Cloudflare, Supabase, Vercel and Resend.

## Does the dashboard control the agents?

No. It observes and visualises them. It cannot pause a tool call or steer a subagent. That is by design. See [Live agent dashboard](Live-Agent-Dashboard).

## What Node version do I need?

Node 20 or newer, on the PATH Claude Code uses. The hooks, helper and MCP server all run on Node.

## Will there be a hosted version?

No. claudepilot stays local-only. If it phoned home it would not be claudepilot. See [Roadmap and limitations](Roadmap-and-Limitations).

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)

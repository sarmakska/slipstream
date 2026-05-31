# Comparisons

How slipstream relates to the obvious alternatives. The honest framing: slipstream is not trying to replace any of these. It composes the real Claude Code extension points into a token-disciplined, memory-preserving workflow.

## Versus a plain CLAUDE.md

`CLAUDE.md` is the standard place to put project context. It is loaded in full every session, by hand, and it rots: it grows, goes stale, and nobody prunes it.

| | CLAUDE.md | slipstream memory |
|---|---|---|
| Storage | one file, hand-edited | one file per fact, frontmatter |
| Loaded | all of it, every session | only the relevant subset, by signal |
| Survives compaction | only if you re-paste it | yes, via the PreCompact digest |
| Recall | you scroll | ranked by branch, files, prompt |

slipstream does not replace `CLAUDE.md`; use it for stable project rules and let slipstream handle the durable, evolving facts.

## Versus reading files with the built-in Read tool

`Read` is the default. It pulls the whole file (or a window if Claude remembers to pass one). slipstream's MCP tools make scoped retrieval the easy path: `sp_symbol` returns one declaration, `sp_map` the index. The measured saving is 71% on a single symbol and reading the map instead of the tree is 5.4% of the cost (see [Token efficiency](Token-Efficiency)). `Read` is still there for the cases where a whole small file genuinely is what you want.

## Versus a vector / embedding memory

Some agent memory layers embed every fact and retrieve by cosine similarity. That needs a model to embed and a store to query. slipstream ranks against a cheap task signal (branch, changed files, prompt) and frontmatter tags instead.

I rejected embeddings deliberately: for "which of my durable decisions matter to the work on this branch", a branch name and a tag answer it well without a model dependency or a vector store. The trade-off is that recall is lexical, so a mistagged memory can be missed; the fix is a tag. See [Design decisions](Design-Decisions).

## Versus the MCP SDK

The official `@modelcontextprotocol/sdk` is the usual way to build an MCP server. slipstream hand-rolls the stdio JSON-RPC loop instead, to keep the bundled server dependency-free and auditable in one file. The protocol surface it needs is small and stable. If a future feature needed more of the protocol, the SDK would become the right call; today it does not.

## Versus a hosted agent-observability product

Hosted dashboards watch agents across a fleet, with accounts and retention. slipstream's dashboard is local-only on purpose: it binds `127.0.0.1`, sends nothing anywhere, and stores a plain JSONL log you own. It watches one machine's sessions and replays them. It will never grow a cloud version; if it phoned home it would not be slipstream. See [Security model](Security-Model).

## Versus a universal scaffolder

slipstream's skill library targets the stack I actually ship on: Cloudflare, Supabase, Vercel, Resend. It is not trying to scaffold every framework. The skill engine is general (anyone can write a skill), but the shipped catalogue is opinionated. See [Roadmap and limitations](Roadmap-and-Limitations).

## See also

- [Design decisions](Design-Decisions) for the reasoning behind each choice.
- [Token efficiency](Token-Efficiency) for the numbers behind the Read comparison.
- [Roadmap and limitations](Roadmap-and-Limitations) for the non-goals.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/slipstream)

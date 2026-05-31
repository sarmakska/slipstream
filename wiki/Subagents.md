# Subagents

slipstream ships three lean subagents under `agents/`. Each is a real Claude Code agent with frontmatter (`name`, `description`, `tools`), and each is token-disciplined: it works through the MCP tools (`sp_map`, `sp_symbol`, `sp_search`, `sp_recall`) rather than reading whole files. You delegate to them with the Task tool, for example "use sp-reviewer to check this before I push".

## sp-shipper

`agents/sp-shipper.md`. Takes a project from scaffold to a deployed site, running every verification gate as it goes.

It orients with `sp_map`, recalls prior stack decisions with `sp_recall` so it does not contradict an earlier call, and works in order: frontend scaffold, backend and data layer, integrations (auth, payments, email as required), then deploy. It treats each skill's `## Verify` block as a gate and runs it as a real command; a gate that exits non-zero blocks it until the cause is fixed. Durable decisions go to `sp_remember`, and it watches `sp_budget` so a long shipping run stays scoped.

**Use when** the user wants a site taken end to end with gates enforced, not just scaffolded.

## sp-schema

`agents/sp-schema.md`. Designs and migrates a Supabase / Postgres schema with row level security.

It recalls existing schema conventions first, designs tables with explicit foreign keys and indexes, writes the migration under `supabase/migrations`, and enables RLS on every table that holds user data. RLS is not optional: a table with RLS enabled and no policy denies all access, which is the safe default it starts from, then it adds the minimum policies the feature needs. It verifies by applying the migration and confirming RLS is on and an unauthorised query is denied.

**Use when** the user is adding or changing database tables and security matters.

## sp-reviewer

`agents/sp-reviewer.md`. A pre-push guardrail. It is read-only on the code: it reports, it does not fix.

It reads the diff (`sp_symbol` / `sp_lines` for changed declarations), runs the project gates (lint, build, tests) via Bash and captures each exit code, scans the diff for leaked secret shapes (`sk_live`, `ghp_`, AWS `AKIA...`, `KEY=`/`TOKEN=`, connection strings), and reviews the diff for correctness blockers. It ends with a verdict: `PASS` only if every gate exited zero, the secret scan is clean and no blocker was found; otherwise `FAIL` with one line per problem. A red gate blocks the push.

**Use when** you are about to commit or push and want a gate that refuses to wave through a broken change.

## Why they use the MCP tools

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#0d1117','primaryTextColor':'#f5f7fa','primaryBorderColor':'#38bdf8','lineColor':'#22d3ee','fontFamily':'monospace'}}}%%
flowchart LR
  Main[main session] -->|Task tool| Sub[subagent]
  Sub --> sp_map
  Sub --> sp_symbol
  Sub --> sp_recall
  sp_map --> Map[project map]
  sp_symbol --> Slice[one declaration]
  sp_recall --> Mem[relevant memories]
```

A subagent runs in its own context window. If it read whole files it would burn that window fast and the main session would never see the result. Working through scoped tools keeps each subagent cheap, which is what makes delegating to several of them practical.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| subagent does not appear | the plugin `agents/` did not ship | `/slipstream:doctor` flags `subagents`; reinstall or `pnpm build` |
| subagent reads whole files anyway | the MCP server is not loaded | check `sp_map` is available; see [MCP tools](MCP-Tools) |
| sp-reviewer passes a broken change | the project gates are not the standard `pnpm` scripts | tell it the exact commands; it runs what the project defines |

## See also

- [MCP tools](MCP-Tools) for the tools the agents use.
- [Skill catalogue](Skill-Catalogue) for the skills sp-shipper drives.
- [Security model](Security-Model) for the secret scan sp-reviewer runs.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/slipstream)

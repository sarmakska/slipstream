# Examples and recipes

Copy-paste flows for the things people actually do with slipstream. Slash commands run inside Claude Code; the `node dist/cli/index.js ...` lines are what the helper does under the hood, useful for scripting or debugging.

## First run on a new project

```
/plugin marketplace add sarmakska/slipstream
/plugin install slipstream
/slipstream:doctor        # confirm the install is wired
/slipstream:map           # build the project map once
```

Then work as normal. Claude will reach for `sp_symbol` and `sp_lines` instead of reading whole files.

## Read one symbol instead of a file

In chat, just ask for the function; Claude calls `sp_symbol`. To do it by hand:

```
node dist/cli/index.js slice . src/map/retrieve.ts retrieveSymbol
```

Returns the declaration with its doc comment, nothing else. For a non-exported region, use a line range:

```
node dist/cli/index.js lines . src/cli/index.js 40 80
```

## Find where something lives

```
node dist/cli/index.js map . --search "session cookie"
```

Ranked locations, no file bodies. In chat this is `sp_search`.

## Save and recall a decision

```
/slipstream:remember
# "We verify Stripe webhooks with the raw request body, not the parsed one"
```

Later, on a stripe branch, it comes back automatically at session start. On demand:

```
/slipstream:recall stripe webhook
```

## Survive a compaction

You do nothing. When Claude Code compacts, the `PreCompact` hook writes a digest; the next session reloads it. To see the digest it would write from a sample:

```
node dist/cli/index.js digest --session demo \
  --activity "decided to use Hono for the API||edited src/api/index.ts" \
  --files src/api/index.ts \
  --open-task "Stand up the API and wire the first route"
```

## Preview the relevant subset recall would reload

```
node dist/cli/index.js recall-signal --branch fix/stripe-webhook \
  --files src/payments/webhook.ts --prompt "verify the signature"
```

Prints only the matching memories, with the match reasons.

## Search what you did weeks ago

Memory builds itself from every turn. To find past work, in chat just ask ("when did we touch the Stripe webhook?") and Claude runs the three-layer search. By hand:

```
node dist/cli/index.js memory search "stripe webhook signature"   # cheap ranked index
node dist/cli/index.js memory timeline 12 --window 2              # context around a hit
node dist/cli/index.js memory observations 12 13                  # full detail for the ids
```

## See what this project keeps making you do

```
node dist/cli/index.js memory lessons --min 3
# - Recurring work on "webhook": 6 observations across 3 sessions, mostly edit; files: src/payments/webhook.ts.
```

In chat this is `sp_lessons`. Promote a recurring lesson to a durable fact with `/slipstream:remember`.

## Check how much slipstream optimised

```
node dist/cli/index.js savings
# slipstream optimization: 18 scoped reads served ~3,100 tokens instead of ~21,800 — saved ~18,700 tokens (86% less than whole-file reads).
```

In chat this is `sp_savings`; it also shows as the `opt %` statusline segment and in the dashboard's Session-work panel. Exact in any editor.

## Set a token budget

Open the dashboard, use the "set budget" panel (target + warn/compact thresholds), or:

```
node dist/cli/index.js budget --bytes 0   # shows the current level against budget.json
```

Inside Claude Code the gauge reads the true context size from the transcript; elsewhere paste your editor's real number into `.claude/slipstream/budget.json` as `actualTokens` to calibrate.

## Use slipstream in Cursor / Windsurf / Antigravity

Register the built server in the editor's MCP config, then ask the agent to call `sp_dashboard` for the live URL:

```json
{ "mcpServers": { "slipstream": { "command": "node", "args": ["/abs/path/to/slipstream/dist/mcp/index.js"] } } }
```

The dashboard fills with no hooks, the budget gauge and optimization total work, and memory search is in the panel. See [Cross-IDE support](Cross-IDE-Support).

## Delegate a pre-push review

In chat: "use sp-reviewer to check this before I push." It runs lint, build, tests and a secret scan, reviews the diff, and ends with `PASS` or `FAIL`. See [Subagents](Subagents).

## Ship a site end to end

In chat: "use sp-shipper to take this from scaffold to deployed on Vercel." It drives the frontend, backend, integration and deploy skills, running each `## Verify` gate and stopping on a red one.

## Watch the session live

The dashboard URL is printed at session start. Open it for the agents, activity stream, token budget bar and mind map. Replay a finished session from the session picker in the header. See [Live agent dashboard](Live-Agent-Dashboard).

## Switch to the terse output style

```
/output-style slipstream
```

Shorter, higher-signal answers. Switch back with `/output-style default`. See [Output style](Output-Style).

## See also

- [MCP tools](MCP-Tools) for the full tool surface.
- [Integrations](Integrations) for the stack-specific skills.
- [Troubleshooting](Troubleshooting) when a step does not behave.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/slipstream)

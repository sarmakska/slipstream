# Examples and recipes

Copy-paste flows for the things people actually do with claudepilot. Slash commands run inside Claude Code; the `node dist/cli/index.js ...` lines are what the helper does under the hood, useful for scripting or debugging.

## First run on a new project

```
/plugin marketplace add sarmakska/claudepilot
/plugin install claudepilot
/claudepilot:doctor        # confirm the install is wired
/claudepilot:map           # build the project map once
```

Then work as normal. Claude will reach for `cp_symbol` and `cp_lines` instead of reading whole files.

## Read one symbol instead of a file

In chat, just ask for the function; Claude calls `cp_symbol`. To do it by hand:

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

Ranked locations, no file bodies. In chat this is `cp_search`.

## Save and recall a decision

```
/claudepilot:remember
# "We verify Stripe webhooks with the raw request body, not the parsed one"
```

Later, on a stripe branch, it comes back automatically at session start. On demand:

```
/claudepilot:recall stripe webhook
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

## Delegate a pre-push review

In chat: "use cp-reviewer to check this before I push." It runs lint, build, tests and a secret scan, reviews the diff, and ends with `PASS` or `FAIL`. See [Subagents](Subagents).

## Ship a site end to end

In chat: "use cp-shipper to take this from scaffold to deployed on Vercel." It drives the frontend, backend, integration and deploy skills, running each `## Verify` gate and stopping on a red one.

## Watch the session live

The dashboard URL is printed at session start. Open it for the agents, activity stream, token budget bar and mind map. Replay a finished session from the session picker in the header. See [Live agent dashboard](Live-Agent-Dashboard).

## Switch to the terse output style

```
/output-style claudepilot
```

Shorter, higher-signal answers. Switch back with `/output-style default`. See [Output style](Output-Style).

## See also

- [MCP tools](MCP-Tools) for the full tool surface.
- [Integrations](Integrations) for the stack-specific skills.
- [Troubleshooting](Troubleshooting) when a step does not behave.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)

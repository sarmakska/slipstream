---
description: Verify the whole claudepilot install end to end and print a pass/fail report.
---

Run claudepilot's self-check so you know the plugin is wired correctly: the MCP
server is built and declared, every hook (including the PreCompact
lossless-compaction hook) is wired, the memory store is reachable, the helper
CLI is built, and the statusline, output style and subagents are present.

## Steps

1. Run `node "${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js" doctor --plugin "${CLAUDE_PLUGIN_ROOT}" --root .`
2. Read the report. Each line is `PASS` or `FAIL` with the thing it checked.
3. If anything is `FAIL`, fix it: a missing `dist/` means the plugin was not
   built (run `pnpm build` in the plugin), a missing PreCompact line means the
   hooks file is stale, a missing subagent means the agents directory did not
   ship.

## Verify

The final line reads "All checks passed. claudepilot is wired correctly." If it
does not, address each FAIL line and run the command again.

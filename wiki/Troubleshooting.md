# Troubleshooting

## Install

### The plugin does not install
Run `/plugin` in Claude Code to see installed plugins. If claudepilot is missing, re-run:

```
/plugin marketplace add sarmakska/claudepilot
/plugin install claudepilot
```

Confirm you are running the commands inside Claude Code in VS Code, not in a terminal.

### Slash commands do nothing
Use the namespaced form: `/claudepilot:map`, not `/map`. If they still do nothing, the plugin did not install; see above.

## Node and hooks

### "node: command not found" from a hook
The plugin's hooks and helper run on Node. Install Node 20 or newer and restart VS Code so its integrated terminal inherits the PATH. Verify with `node --version`.

### A hook prints nothing
That is expected for the silent paths: no memory yet (SessionStart and UserPromptSubmit stay quiet), a small file read (PreToolUse does not warn), or a stop that did not draw the probabilistic reminder.

## Token efficiency

### Claude still reads whole files
Make sure a map exists: run `/claudepilot:map`. The `PreToolUse` warning and the `UserPromptSubmit` reminder only engage once `.claude/claudepilot/map.md` is present. The warning is a nudge, not a block, so Claude can still choose a whole-file read.

### A slice returns the wrong span
The brace walker is heuristic. Fall back to a line range: `npx claudepilot lines . <file> <start> <end>`. Widen the range if needed.

### The map is stale
Re-run `/claudepilot:map` after structural changes. The map is a snapshot.

## Memory

### Recall returns nothing
The query shares no terms with any memory's description or tags. Rephrase, or list everything with `npx claudepilot memory list --root .`.

### MEMORY.md looks out of date
Regenerate it from the files: `npx claudepilot memory index --root .`.

### A memory is wrong
Update it by saving again with the same name, or remove it with `/claudepilot:forget` or `npx claudepilot memory prune <name> --root .`.

## Live agent dashboard

### The URL did not appear in the chat
The dashboard hook imports the compiled launcher from `dist/`. In a dev checkout, run `pnpm build` first. If the dashboard is disabled, check `.claude/claudepilot/dashboard.json` (`"enabled": false`) or the `CLAUDEPILOT_DASHBOARD=0` environment override.

### The browser did not open
Auto-open is best-effort and skipped on headless or sandboxed machines. Use the URL printed in the chat, or run `npx claudepilot dashboard start . --open`. To stop it opening, set `"autoOpen": false` or export `CLAUDEPILOT_DASHBOARD_OPEN=0`.

### No events are showing
Confirm the hooks are wired with `npx claudepilot plugin-validate` (it lists `PostToolUse` and `SubagentStop`), and that Node is on PATH so the hooks can run. Check the log is growing: `cat .claude/claudepilot/dashboard/<session>.jsonl`. If the file has lines but the UI is empty, you are viewing a different session in the header dropdown.

### Port in use, or a stale server
The server binds port 0, so the OS picks a free port and clashes should not happen. If `server.json` points at a dead server, the next start detects the dead pid or closed port and replaces it. To force a clean start, delete `.claude/claudepilot/dashboard/server.json`.

### A second start spawned nothing
That is correct. Start is idempotent: a live server is reused, and the helper prints `already running at ...`.

## Validation

### plugin-validate fails
It names each problem with its file. Common causes: malformed JSON in `plugin.json` or `marketplace.json`, a hook event not wired in `hooks/hooks.json`, a `SKILL.md` missing `name`, `description` or a verification gate, a skill directory name that does not match its `name`, or a command without frontmatter. Fix the named files and rerun:

```
npx claudepilot plugin-validate
```

### validate reports skill issues
Same idea, scoped to skills. Each issue names the `SKILL.md` and the fault. See [Writing a skill](Writing-a-Skill).

## Build and CI

### pnpm build fails locally
Use Node 20 or newer and pnpm 10. Run `pnpm install` first, then `pnpm build`.

### CI is red
The workflow runs install, lint, build, skill validation, plugin validation and tests. The failing step's log names the cause. Reproduce locally with the same `pnpm` scripts.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)

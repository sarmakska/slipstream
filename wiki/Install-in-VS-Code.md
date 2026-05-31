# Install in VS Code

claudepilot is a Claude Code plugin. The whole product lives inside Claude Code in VS Code. This page is the canonical install path.

## Requirements

- VS Code with the Claude Code extension installed and signed in.
- Node 20 or newer on your PATH. The plugin's hooks and helper run on Node, and the slash commands call the helper through `npx`.

Check Node from the VS Code integrated terminal:

```
node --version
```

## Install

Inside Claude Code (the chat input), run:

```
/plugin marketplace add sarmakska/claudepilot
/plugin install claudepilot
```

The first command registers the SarmaLinux marketplace defined in `.claude-plugin/marketplace.json`. The second installs the plugin described in `.claude-plugin/plugin.json`, which wires the skills, the slash commands and the hooks.

## First session

1. Open your project folder in VS Code and start a Claude Code session. The `SessionStart` hook runs `hooks/session-start.mjs`, which loads your project memory index (if any) and reminds Claude to read the map before whole files.
2. Build the project map:
   ```
   /claudepilot:map
   ```
   This writes `.claude/claudepilot/map.md` and `.claude/claudepilot/map.json`. From here Claude reads the index and pulls single slices instead of whole files.
3. Work as normal. Save durable decisions with `/claudepilot:remember`, recall them with `/claudepilot:recall`, see the picture with `/claudepilot:mindmap`, and check the budget with `/claudepilot:status`.

## Verifying the install

Run `/claudepilot:validate` in the chat, or from the terminal in the repo:

```
npx claudepilot plugin-validate
```

It checks the manifest, the marketplace file, the hooks wiring, the slash commands and every skill, and prints `OK: plugin valid` when all is well.

## Failure modes

- "command not found: node" in a hook. Node is not on the PATH Claude Code uses. Install Node 20 or newer and restart VS Code so the terminal inherits it.
- The slash commands do nothing. Confirm the plugin installed with `/plugin` and that you are typing the namespaced form, `/claudepilot:map` not `/map`.
- No memory loads at session start. There is no memory yet. Save one with `/claudepilot:remember` and it will load next session.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)

---
description: Validate the slipstream plugin and skill library, failing on anything malformed.
---

Validate the slipstream plugin before relying on it: the plugin manifest, the marketplace file, the hooks wiring, the slash commands, and every SKILL.md frontmatter.

## Steps

1. Run `npx slipstream plugin-validate`. It checks `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/hooks.json`, the `commands/` frontmatter and the whole skill library.
2. If it reports issues, open the named files and fix them: malformed JSON, a missing hook event, a skill missing its `name`, `description` or verification gate, or a command without frontmatter.
3. Rerun until it prints `OK` with the list of checks that passed.

## Verify

Confirm `npx slipstream plugin-validate` exits zero and prints `OK: plugin valid`.

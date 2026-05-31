# Hooks

claudepilot wires four Claude Code hooks in `hooks/hooks.json`. They are what make the memory and token discipline automatic rather than something you have to remember. Each hook is a dependency-free Node script that prints JSON on stdout and never throws, because a hook that crashes would block the session.

## hooks.json

```json
{
  "hooks": {
    "SessionStart": [{ "matcher": "startup|resume", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs\"" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/user-prompt-submit.mjs\"" }] }],
    "PreToolUse": [{ "matcher": "Read", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/pre-tool-use.mjs\"" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/stop.mjs\"" }] }]
  }
}
```

`${CLAUDE_PLUGIN_ROOT}` is set by Claude Code to the installed plugin directory.

## SessionStart: load memory, nudge the map

`hooks/session-start.mjs` reads `.claude/claudepilot/memory/MEMORY.md` and injects it as `additionalContext`, so Claude opens the session with the project's durable facts loaded. It also reminds Claude to read the project map before whole files. If there is no memory yet, it suggests saving one. It matches both `startup` and `resume`.

Output shape:

```json
{ "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "..." } }
```

## UserPromptSubmit: recall and read scoped

`hooks/user-prompt-submit.mjs` fires on each new prompt. When a map and memory already exist, it injects a short reminder to recall relevant memory and to use the map and slices. It stays silent on a fresh checkout so it does not nag.

## PreToolUse on Read: warn on large whole-file reads

`hooks/pre-tool-use.mjs` reads the tool input from stdin. If the target file is larger than 16 KB and the read is a whole-file read (no offset or limit), it injects a note with the approximate token cost and points at scoped retrieval. It returns `permissionDecision: "allow"`, so it warns without blocking. A read that already has an offset or limit is left alone.

## Stop: persist durable facts

`hooks/stop.mjs` fires when Claude finishes responding. Roughly one stop in three, it injects a reminder to save any durable decision, convention or gotcha with `/claudepilot:remember`. It is intentionally light and probabilistic so it does not loop or become noise; the agent decides whether anything is worth keeping.

## Testing a hook by hand

```
CLAUDE_PLUGIN_ROOT=$(pwd) node hooks/session-start.mjs
echo '{"tool_input":{"file_path":"/path/to/big-file.ts"}}' | node hooks/pre-tool-use.mjs
```

Each prints a single JSON object (or nothing, for the silent paths).

## Failure modes

- A hook prints nothing. That is normal for the silent paths (no memory yet, a small file read, a stop that did not draw the reminder).
- "node: command not found". Node is not on the PATH Claude Code uses. Install Node 20 or newer and restart VS Code.
- The memory context does not appear. There is no `MEMORY.md` yet. Save a memory and restart the session.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)

# Cross-IDE support

slipstream's full experience — skills, hooks, lossless compaction, the statusline and the dashboard — runs inside Claude Code. But the token-saving core and now the **live dashboard and budget gauge** work in any MCP-capable editor: Cursor, Windsurf, Antigravity, generic VS Code, anything that speaks the Model Context Protocol.

The trick is that the MCP server is the one component every editor runs, and the standalone web dashboard is the one UI that works everywhere (a browser tab beside the editor). So the MCP server feeds itself and the dashboard, with no editor hooks required.

## The architecture

```
Editor (Cursor / Windsurf / Antigravity / VS Code)
        │ stdio (MCP)
        ▼
slipstream MCP server ──writes──►  .claude/slipstream/   (project-local store)
        │ (auto-starts dashboard)   ├─ dashboard/<session>.jsonl   per-tool activity
        ▼                           ├─ budget.json                 target + thresholds
slipstream dashboard (127.0.0.1 + SSE)  └─ observations/…          self-built memory
        ▲
   browser tab (the universal UI)
```

One project-local store is the source of truth: the MCP server writes, the dashboard tails it over server-sent events.

## What works where

| Capability | Claude Code (plugin) | Cursor / Windsurf / Antigravity / VS Code (MCP) |
|---|---|---|
| `sp_*` navigation + memory tools | ✅ | ✅ |
| Live activity dashboard | ✅ via hooks | ✅ via MCP-server-emitted events |
| Token-budget gauge + control | ✅ statusline + dashboard | ✅ dashboard gauge + `budget.json` |
| Auto-start dashboard | ✅ SessionStart hook | ✅ MCP server boots it |
| Auto-captured observation memory | ✅ Stop hook | ⚠️ run `slipstream observe`, or capture via the dashboard feed |
| Skills / slash commands / statusline | ✅ | ⚠️ Claude Code features; partially replaced by MCP tools + dashboard |

## How it works

**Phase 1 — the server feeds the dashboard.** After every `tools/call`, the MCP server appends a `post-tool` event to the same append-only log the hooks use (`src/mcp/server.ts`), so the dashboard fills with activity even though Cursor/Windsurf expose no hooks. Each connection gets a readable session id derived from the client name (`sessionFromClient`), so each editor session is distinct in the picker. Inside Claude Code the PostToolUse hook already emits, so the plugin sets `SLIPSTREAM_MCP_EMIT=0` to keep the server quiet and avoid double-counting.

**Phase 2 — zero setup.** On connect the server starts the dashboard itself (detached, idempotent), gated by `SLIPSTREAM_DASHBOARD` (the plugin sets it to `0` because its SessionStart hook already does this). Ask the agent to "open the dashboard" and the `sp_dashboard` tool returns the URL in any editor.

**Phase 3 — budget control.** A single `.claude/slipstream/budget.json` (`targetTokens`, `warnPct`, `compactPct`, optional `actualTokens`) is read by the dashboard gauge, the `sp_budget` tool and the statusline alike, so they always agree. The dashboard gauge climbs as tools pull context, turning amber then red at your thresholds, and a panel lets you set them. The gauge measures *context slipstream pulled in* — an estimate, not the model's true token count, which no MCP server can see. Paste your editor's real number into `actualTokens` to calibrate.

**Phase 4 — the work view.** The dashboard shows a rolled-up "Session work" panel — files touched, a tool-use breakdown and cumulative tokens — alongside the activity stream, plan, mind map and memory search, with a multi-session switcher and live SSE refresh.

## Setting it up in another editor

```
git clone https://github.com/sarmakska/slipstream
cd slipstream
pnpm install
pnpm build
```

Register the built server in your editor's MCP config:

```json
{
  "mcpServers": {
    "slipstream": {
      "command": "node",
      "args": ["/absolute/path/to/slipstream/dist/mcp/index.js"]
    }
  }
}
```

- **Cursor**: `.cursor/mcp.json` in the project, or Settings → MCP.
- **Windsurf**: `~/.codeium/windsurf/mcp_config.json`, or Settings → Cascade MCP.
- **Antigravity**: Settings → MCP section.
- **Any MCP client**: wherever it reads an `mcpServers` block.

Open the editor, ask the agent to orient with `sp_map` and to call `sp_dashboard`, then open the printed `127.0.0.1` URL. The dashboard fills as the agent works.

## Honest limitations

- The budget gauge is **estimated context pulled by slipstream**, not the model's true token count — no MCP server can read that. It is still useful (slipstream's job is shrinking what gets pulled in), and `actualTokens` lets you calibrate.
- Skills, slash commands and the statusline are Claude Code plugin features. Outside it they are partially replaced by MCP tools and the dashboard, not reproduced one-to-one.
- A true in-editor panel (versus a browser tab) would need a dedicated editor extension; the browser dashboard is the portable surface.

## See also

- [MCP tools](MCP-Tools) — every `sp_` tool, including `sp_dashboard` and `sp_lessons`.
- [Live agent dashboard](Live-Agent-Dashboard) — the dashboard internals.
- [Configuration and tuning](Configuration-and-Tuning) — `SLIPSTREAM_MCP_EMIT`, `SLIPSTREAM_DASHBOARD` and `budget.json`.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/slipstream)

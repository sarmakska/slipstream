---
description: Render the project mind map as a Mermaid diagram directly in the chat.
---

Show the project structure as a live mind map inside Claude Code, so you and the user share a picture of the codebase without leaving the chat.

## Steps

1. Run `npx claudepilot mindmap .` to print a Mermaid flowchart of the project, themed with the SarmaLinux palette.
2. Render the Mermaid block in your reply so the user sees the diagram in chat.
3. To produce a shareable file, run `npx claudepilot mindmap . --html .claude/claudepilot/mindmap.html`, which writes a self-contained HTML artifact the user can open in a browser.

## Verify

Confirm the Mermaid block parses (a `flowchart LR` header followed by node edges) and reflects the current project layout.

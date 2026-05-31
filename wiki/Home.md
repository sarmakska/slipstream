# claudepilot by sarmalinux

claudepilot is a Claude Code plugin. You install it into Claude Code in VS Code and it makes Claude work for hours without running out of context or wasting tokens, by giving Claude a persistent memory and a disciplined, token-efficient way to read your codebase, plus a curated library of guardrailed skills for shipping production sites on Cloudflare, Supabase, Vercel and Resend.

It is not a CLI tool. There is a small helper binary the plugin calls from its hooks and slash commands, but you never run that as the product.

## The four pillars

1. Token efficiency, so you rarely hit context limits. A compact project map, scoped retrieval by symbol or line range, hooks that nudge scoped reads, and a context budget estimate.
2. Persistent memory. One fact per file with frontmatter, a regenerated MEMORY.md index, loaded at session start so knowledge survives across sessions.
3. A guardrailed skill library. 59 Claude Code agent skills, each shipping skill carrying a verification gate.
4. A live mind map and status, rendered in the Claude Code chat.

## Where to go next

- [Install in VS Code](Install-in-VS-Code)
- [Architecture](Architecture)
- [Token efficiency](Token-Efficiency)
- [Memory system](Memory-System)
- [Skill engine](Skill-Engine)
- [Skill catalogue](Skill-Catalogue)
- [Writing a skill](Writing-a-Skill)
- [Hooks](Hooks)
- [Mind map and status](Mind-Map-and-Status)
- [Integrations](Integrations)
- [Troubleshooting](Troubleshooting)

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)

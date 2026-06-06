# Slipstream strategy and competitive positioning

Author: Sarma. Updated 6 June 2026.

This is the working strategy document for slipstream. It is honest about what
slipstream is, what it is not, where it is weaker than the alternatives, and
what it will ship next. If you are reading this from a fork or as a
prospective contributor, the goal is to make the bets visible so you can argue
with them.

## What slipstream is in one sentence

**Slipstream is the observability and memory layer that sits behind whichever
AI coding tool you already use, makes the agent remember across sessions, cuts
its token cost by around 70 percent on real reads, and shows you what it just
did in a local dashboard.**

It is not another AI coding agent. It does not have its own chat sidebar. It
does not lock you into one editor. It runs as an MCP server underneath Claude
Code, Cursor, Windsurf, Antigravity, VS Code with MCP, and JetBrains with MCP.

## Honest positioning vs the field

The AI coding tools market is crowded and most of the oxygen sits in two
buckets: native agents (Cursor, Cline, Continue, Aider) and observability
platforms (LangSmith, Helicone, Langfuse). Slipstream is neither, which is
both the opportunity and the marketing problem.

### Native AI coding agents

| Tool | Stars (approx) | What it does well | Where slipstream wins |
|---|---|---|---|
| Cursor | proprietary | Polished editor, large user base | Cursor is closed and cloud-dependent. Slipstream runs inside Cursor as MCP and adds memory plus local observability that Cursor itself does not expose. |
| Cline (formerly Claude Dev) | 30k+ | VS Code native, popular, free, integrated chat | Cline is editor-locked to VS Code. Slipstream runs across six editors and adds cross-session memory that Cline does not have. |
| Continue | 25k+ | Cross-editor agent for VS Code and JetBrains | Same answer as Cline. Continue is its own agent. Slipstream is a tool surface plus memory that any agent can call. |
| Aider | 30k+ | Terminal-first, git-aware, popular | Aider is terminal only. Slipstream has a terminal CLI, an editor MCP surface, and a dashboard. |
| Codeium / Windsurf Cascade | proprietary | Editor integration, big team | Cascade is closed. Slipstream is MIT. |
| Goose (Block) | small but growing | Open-source MCP-based agent | Closest peer. Goose is broader, slipstream is narrower and more opinionated about token efficiency and cross-IDE parity. |

The pattern: every native agent gives you a chat sidebar. Slipstream does not.
The intentional bet is that **agents will commodify; the layer below them is
where durable value sits**. Whether that bet pays out is the open question.

### Observability platforms

| Tool | What it does well | Where slipstream is weaker | Where slipstream is stronger |
|---|---|---|---|
| LangSmith | Production traces, cost tracking, eval datasets, hosted dashboard | No cost tracking, no production fleet view, no hosted version | Local-only, no telemetry, no account required, MCP-native, six editors |
| Helicone | Drop-in proxy, observability, caching, hosted | Slipstream is not a proxy and does not track per-API spend | No cloud account, no data leaves the machine, designed around the coding agent loop not LLM calls in general |
| Langfuse | Self-host option, traces, evals | No trace export, no per-call timeline yet | Coding-agent-shaped (observations, lessons, drift) rather than LLM-call-shaped |
| OpenLLMetry | Open-source instrumentation | Slipstream does not emit OpenTelemetry | Built around the coding workflow not the LLM call |

The pattern: every observability platform is cloud-first and LLM-call-shaped.
Slipstream is local-first and coding-agent-shaped. The bet is that
**developers want a private local view of what the agent did on their machine
this week**, not a hosted SaaS dashboard with a billing page.

### Where slipstream is uniquely positioned

1. **Cross-editor by default.** One MCP server, six editor install paths,
   identical behaviour. No other open-source tool ships this.
2. **Local-first observability.** 127.0.0.1 only, no telemetry, no account.
   No other open-source tool ships a coding-agent dashboard with this story.
3. **Self-building memory.** Observations are captured automatically from tool
   calls; three-layer search; lossless compaction via PreCompact digest. Most
   peers either have memory you have to opt into manually or no memory at all.
4. **MIT, in the open, weekend-shipping cadence.** Eleven tagged releases in
   two months. That is a real signal of project velocity.

### Where slipstream is currently weaker

Naming these so they are visible and so the roadmap targets them.

1. **No chat sidebar.** Most users want to type a prompt and see the answer
   in their editor. Slipstream lives behind the curtain. That is by design but
   it is also a marketing problem: there is nothing to demo on screen except
   "here is the dashboard."
2. **Dashboard shows data not insight.** Tiles, heatmap, donut, file list.
   Numbers without interpretation. A user has to compose the sentence
   themselves. Competitors (LangSmith, Posthog) ship the sentence ready-made.
3. **No production cost tracking.** LangSmith and Helicone both quantify
   spend. Slipstream measures opt percentage versus whole-file but does not
   sum dollar cost yet.
4. **No public benchmarks.** No reproducible "here is X tokens saved on Y
   repo with Z agent" with a script and a number. Competitors have polished
   case studies.
5. **No demo video, no GIFs, no screenshot gallery.** Cline has a homepage
   that shows the loop in motion. Slipstream has a wall of text.
6. **Seven stars on the related Sarmalink-AI flagship, low star velocity.**
   Awareness is the bottleneck, not the code.
7. **No team sharing.** Everything is local. There is no "share this session
   with a teammate" beyond the replay export.

## The four bets that matter most

If only four things ship in the next 30 days, they are these, in order.

### Bet 1: Dashboard insights band (this weekend, v0.8.0)

Turn the dashboard from a data viewer into a sentence generator. Every tab
gets a top band with one natural-language paragraph plus three bullet
insights, computed deterministically from the existing observation store. No
LLM, no hallucination.

What this looks like:

- Live tab top band: "Session 4f2a: 47 tool calls, 72 percent optimised
  versus whole-file, projected 12 steps to compact. Three files in focus:
  auth.ts, billing.ts, settings.ts."
- Project tab top band: "Across 12 sessions and 312 observations, your focus
  this week has been the auth flow (38 percent of edits). Two drift flags
  need review. Memory is growing at 26 observations per session, up from 18
  last week."
- Journal tab top band: per-day paragraph naming the three most-touched
  files, the dominant activity window, the opt percentage and any drift.
- Sessions tab: rank sessions by anomaly score. Flag sessions that burned
  budget faster than the project average.
- Drift entries: every flag becomes a one-line story.

Implementation: new `/api/insights/<tab>` endpoints, templated natural-language
summaries over existing observation queries. Zero new persistence. Zero LLM
dependency. Tests for every template branch.

This closes the single biggest gap the project has against LangSmith,
Helicone and Posthog.

### Bet 2: Public benchmarks page (next week)

A single page at `sarmalinux.com/products/slipstream/benchmarks` (and a
section in the README) with:

- One real codebase as the test target (likely this repo).
- Three measurement scripts: token usage with whole-file reads, with
  slipstream scoped reads, with slipstream plus PreCompact compaction.
- A table showing tokens saved per session and dollar cost saved at 2026
  Claude pricing.
- Reproducibility: every measurement is a checked-in script anyone can run.

This converts "70 percent token savings" from a marketing claim into a
verifiable number with a reproducible script. That is what LangSmith does. We
should do the same.

### Bet 3: Demo video plus animated GIF in the README (next week)

Sixty seconds. Three scenes.

- Scene 1: install via `npx slipstream-setup --editor=cursor`.
- Scene 2: ask Cursor to refactor a file. Show `sp_symbol` pulling 1,400
  bytes instead of 4,800.
- Scene 3: open the dashboard. Show the new insights band reading the
  session aloud in plain English.

Embed the GIF at the top of the README. Link the full video on YouTube.
Currently the README is 35 KB of text with zero visual. That is a marketing
mistake.

### Bet 4: Reframe the homepage one-liner

The current product page leads with "Claude Code plugin and cross-IDE MCP
toolkit". That is accurate and forgettable. It should be:

> Whichever AI coding agent you use, slipstream makes it remember across
> sessions, cut tokens by around 70 percent, and shows you what it just did
> in a local dashboard. Cursor, Claude Code, Windsurf, Antigravity, VS Code,
> JetBrains. MIT, local-only, no telemetry, 208 tests.

Lead with the user benefit. Cross-IDE is a feature, not the positioning.

## Bets we are not making

To be visible about what we are not pursuing, and why.

- **A chat sidebar.** That market has Cline, Continue, Cursor. We will not
  win there. Our bet is that agents commodify and the layer below is where
  durable value sits.
- **A hosted cloud version.** Local-first is the trust story. A cloud version
  would dilute it. If there is ever a hosted layer it is for team-shareable
  observation rollups, not the dashboard itself.
- **Production LLM-call observability.** That is LangSmith's lane. We are
  optimised for the coding agent loop, not the full LLM trace.
- **A skill marketplace.** Promising but a six-week build. Wait until there
  are enough users that a marketplace has supply and demand.

## What we measure to know any of this is working

Honest signal definitions so we know whether to keep going, adjust, or stop.

- **Week 1 (5 to 11 June):** any external star, any external issue. If zero
  by Wednesday, the marketing framing is not landing. Adjust the homepage and
  the README first, do not rewrite the code.
- **Month 1 (5 June to 5 July):** any external contributor (issue or PR from
  someone who is not me). That is the first real signal that the project
  speaks to anyone else.
- **Month 3:** any unsolicited user testimonial. Someone telling me unprompted
  that slipstream changed how they work. That is the second real signal.

Before each of those windows closes, anything below the threshold is noise,
not data. Decisions about pivot or shutdown happen at those windows, not
before.

## What can go wrong

- The "layer below the agent" thesis is wrong. Users want chat, not
  observability. In that case slipstream is a hobby project, not a product.
  Acceptable outcome: the engineering and the wiki are real, the work was not
  wasted, and it informs the next thing.
- A larger competitor (Continue or Cursor) ships built-in observability and
  memory inside the editor. In that case the value shifts to the cross-editor
  story. Stay neutral, stay MIT, lean into "we work with all of them."
- The seven-star adoption signal stays flat for six months. In that case the
  thesis is sound but the marketing is not reaching anyone. Pivot to
  distribution: HN launch, conference talks, contributed wiki pages on AI
  newsletters.

## The next concrete action

Ship the dashboard insights band today, before 17:00 UK time. Tag v0.8.0.
Update the site banner with one line about the new feature. Then close the
laptop for the weekend.

Monday: write up the benchmarks page. Tuesday: record the demo video.
Wednesday: review week-one signal and decide whether to adjust framing.

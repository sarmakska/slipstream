#!/usr/bin/env node
// slipstream SubagentStop hook.
//
// Claude Code fires this when a Task subagent finishes. We record it against the
// subagent's own id so its activity groups separately in the dashboard and its
// status flips to done (or failed). Claude Code does not currently expose a
// matching SubagentStart event, so the dashboard infers a subagent's existence
// from the first event that names it; this stop is the reliable lifecycle point.

import { readPayload, sessionId, emit } from "./emit.mjs";

const payload = await readPayload();
const session = sessionId(payload);
const agent = payload.subagent_id || payload.agent_id || "subagent";
const failed = Boolean(payload.error || payload.failed);

emit({
  session,
  agent: String(agent),
  kind: "subagent-stop",
  label: failed ? "subagent failed" : "subagent finished"
});

process.exit(0);

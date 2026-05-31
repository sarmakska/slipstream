#!/usr/bin/env node
// claudepilot Stop hook.
//
// When Claude Code finishes responding, this nudges it to persist anything
// durable it learned so the knowledge survives the next compaction or session.
// It deliberately does not force a write (that would loop), it leaves a reminder
// in the transcript via additionalContext, and it only fires occasionally so it
// is not noisy. The agent decides what, if anything, is worth a memory.

import { readPayload, sessionId, emit } from "./emit.mjs";

const payload = await readPayload();
const session = sessionId(payload);
emit({ session, kind: "stop", label: "turn finished" });

const output = {
  hookSpecificOutput: {
    hookEventName: "Stop",
    additionalContext:
      "claudepilot: if this turn produced a durable decision, convention, or " +
      "gotcha, save it with /claudepilot:remember so it survives future " +
      "sessions and compactions. Skip if nothing lasting changed."
  }
};

// Roughly one in three stops carries the reminder, to keep it light.
if (Math.random() < 0.34) {
  process.stdout.write(JSON.stringify(output));
}
process.exit(0);

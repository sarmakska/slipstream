#!/usr/bin/env node
// slipstream Stop hook.
//
// When Claude Code finishes responding, this nudges it to persist anything
// durable it learned so the knowledge survives the next compaction or session.
// It deliberately does not force a write (that would loop), it leaves a reminder
// in the transcript via additionalContext, and it only fires occasionally so it
// is not noisy. The agent decides what, if anything, is worth a memory.

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readPayload, sessionId, emit, withLatencyGuard } from "./emit.mjs";

const here = dirname(fileURLToPath(import.meta.url));

await withLatencyGuard("stop", async () => {
const payload = await readPayload();
const session = sessionId(payload);
await emit({ session, kind: "stop", label: "turn finished" });

// Fold this turn into the observation store so memory builds itself. The stop
// event above closes the turn, so by the time capture runs the turn is complete.
// Run it in-process and await it: a detached child does not survive the hook's
// immediate exit on Windows, which left the observation store permanently empty.
// Swallowed and best-effort: capturing memory must never break the session.
try {
  const memory = await import(pathToFileURL(join(here, "..", "dist", "memory", "index.js")).href);
  await memory.captureObservations(process.cwd(), String(session));
} catch {
  // No dist build, or capture failed: stay silent, never break the session.
}

const output = {
  hookSpecificOutput: {
    hookEventName: "Stop",
    additionalContext:
      "slipstream: if this turn produced a durable decision, convention, or " +
      "gotcha, save it with /slipstream:remember so it survives future " +
      "sessions and compactions. Skip if nothing lasting changed."
  }
};

// Roughly one in three stops carries the reminder, to keep it light.
if (Math.random() < 0.34) {
  process.stdout.write(JSON.stringify(output));
}
});
process.exit(0);

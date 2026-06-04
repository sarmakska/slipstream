#!/usr/bin/env node
// slipstream Stop hook.
//
// When Claude Code finishes responding, this nudges it to persist anything
// durable it learned so the knowledge survives the next compaction or session.
// It deliberately does not force a write (that would loop), it leaves a reminder
// in the transcript via additionalContext, and it only fires occasionally so it
// is not noisy. The agent decides what, if anything, is worth a memory.

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPayload, sessionId, emit } from "./emit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "dist", "cli", "index.js");

const payload = await readPayload();
const session = sessionId(payload);
emit({ session, kind: "stop", label: "turn finished" });

// Fold this turn into the observation store so memory builds itself. The stop
// event above closes the turn, so by the time capture runs the turn is complete.
// Detached and swallowed: capturing memory must never block or break the session.
try {
  const child = spawn(
    process.execPath,
    [cli, "observe", "--root", process.cwd(), "--session", String(session)],
    { cwd: process.cwd(), stdio: "ignore", detached: true }
  );
  child.unref();
} catch {
  // Never let observation capture break the session.
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
process.exit(0);

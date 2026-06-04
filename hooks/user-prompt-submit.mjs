#!/usr/bin/env node
// slipstream UserPromptSubmit hook.
//
// On each new user prompt it reminds Claude Code to retrieve scoped context: to
// recall relevant memories and to read the project map before opening files.
// The reminder is kept short so it costs almost nothing, and it only fires when
// a map already exists, so it does not nag on a fresh checkout.

import { stat } from "node:fs/promises";
import { join } from "node:path";
import { readPayload, sessionId, emit, withLatencyGuard } from "./emit.mjs";

const cwd = process.cwd();

await withLatencyGuard("user-prompt-submit", async () => {
const payload = await readPayload();
const session = sessionId(payload);
const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
emit({
  session,
  kind: "user-prompt",
  label: prompt ? prompt.slice(0, 200) : "user prompt"
});

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const hasMap = await fileExists(
  join(cwd, ".claude", "slipstream", "map.md")
);
const hasMemory = await fileExists(
  join(cwd, ".claude", "slipstream", "memory", "MEMORY.md")
);

const hints = [];
if (hasMemory) {
  hints.push(
    "Before answering, recall relevant durable facts with /slipstream:recall " +
      "if this touches a prior decision."
  );
}
if (hasMap) {
  hints.push(
    "Use the project map and scoped slices rather than reading whole files."
  );
}

if (hints.length === 0) {
  return;
}

const output = {
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: "slipstream reminder: " + hints.join(" ")
  }
};

process.stdout.write(JSON.stringify(output));
});

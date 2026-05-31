#!/usr/bin/env node
// claudepilot UserPromptSubmit hook.
//
// On each new user prompt it reminds Claude Code to retrieve scoped context: to
// recall relevant memories and to read the project map before opening files.
// The reminder is kept short so it costs almost nothing, and it only fires when
// a map already exists, so it does not nag on a fresh checkout.

import { stat } from "node:fs/promises";
import { join } from "node:path";

const cwd = process.cwd();

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const hasMap = await fileExists(
  join(cwd, ".claude", "claudepilot", "map.md")
);
const hasMemory = await fileExists(
  join(cwd, ".claude", "claudepilot", "memory", "MEMORY.md")
);

const hints = [];
if (hasMemory) {
  hints.push(
    "Before answering, recall relevant durable facts with /claudepilot:recall " +
      "if this touches a prior decision."
  );
}
if (hasMap) {
  hints.push(
    "Use the project map and scoped slices rather than reading whole files."
  );
}

if (hints.length === 0) {
  process.exit(0);
}

const output = {
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: "claudepilot reminder: " + hints.join(" ")
  }
};

process.stdout.write(JSON.stringify(output));

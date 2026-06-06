#!/usr/bin/env node
// slipstream UserPromptSubmit hook.
//
// On each new user prompt it reminds Claude Code to retrieve scoped context: to
// recall relevant memories and to read the project map before opening files.
// The reminder is kept short so it costs almost nothing, and it only fires when
// a map already exists, so it does not nag on a fresh checkout.

import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readPayload, sessionId, emit, withLatencyGuard } from "./emit.mjs";

const cwd = process.cwd();
const here = dirname(fileURLToPath(import.meta.url));

await withLatencyGuard("user-prompt-submit", async () => {
const payload = await readPayload();
const session = sessionId(payload);
const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
await emit({
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

// Deliver any messages left for the agent on the dashboard. They were queued
// locally; the agent sees them now, on this turn. Drained so each is delivered
// once.
let messageBlock = "";
let busBlock = "";
try {
  const memory = await import(pathToFileURL(join(here, "..", "dist", "memory", "index.js")).href);
  const messages = await memory.drainMessages(cwd, String(session));
  if (messages.length) {
    messageBlock = "Messages left for you on the slipstream dashboard:\n" +
      messages.map((m) => `- ${m}`).join("\n");
  }
  // Cross-tab coordination: what other open sessions are working on right now.
  busBlock = memory.renderBus(await memory.loadBus(cwd), String(session));
} catch {
  // No dist, inbox or bus: nothing extra to inject.
}

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

const parts = [];
if (messageBlock) parts.push(messageBlock);
if (busBlock) parts.push(busBlock);
if (hints.length > 0) parts.push("slipstream reminder: " + hints.join(" "));
if (parts.length === 0) {
  return;
}

const output = {
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: parts.join("\n\n")
  }
};

process.stdout.write(JSON.stringify(output));
});

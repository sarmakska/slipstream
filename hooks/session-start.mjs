#!/usr/bin/env node
// claudepilot SessionStart hook.
//
// It opens every session token-efficient, memory-aware and observable. It:
//  1. starts the live agent dashboard if it is not already running (idempotent),
//     binding 127.0.0.1 on a free port, and prints the localhost url in chat;
//  2. records a session-start event so the dashboard has something to show;
//  3. loads the project memory index so durable facts survive across sessions;
//  4. nudges Claude Code to read the compact project map before whole files.
//
// Output is the additionalContext field of a hookSpecificOutput object, which
// Claude Code injects into the session. The script never throws: a hook that
// crashes would block the session, so every failure path degrades to a hint.

import { readFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readPayload, sessionId, emit } from "./emit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

async function readIfExists(path) {
  try {
    await stat(path);
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

const payload = await readPayload();
const session = sessionId(payload);

// Boot the dashboard. We import the compiled launcher directly so we can read
// back the chosen url; if dist is not built yet (dev checkout) this is skipped.
let dashboardLine = null;
try {
  const launch = await import(join(here, "..", "dist", "dashboard", "index.js"));
  const settings = await launch.loadSettings(cwd);
  if (settings.enabled) {
    const result = await launch.startDashboard({
      projectRoot: cwd,
      session,
      detached: true
    });
    if (settings.autoOpen && result.started) launch.openInBrowser(result.url);
    dashboardLine =
      `Live agent dashboard: ${result.url} ` +
      (result.started ? "(just started)" : "(already running)") +
      ". It streams this session locally; nothing leaves the machine.";
  }
} catch {
  // No dashboard available in this checkout; carry on.
}

emit({ session, kind: "session-start", label: "session started" });

const lines = [];
lines.push("claudepilot is active in this project.");
if (dashboardLine) {
  lines.push("");
  lines.push(dashboardLine);
}
lines.push("");
lines.push("Token discipline: prefer the project map over whole files.");
lines.push(
  "Run /claudepilot:map to refresh .claude/claudepilot/map.md, read that index, " +
    "then pull single symbols or line ranges with the slice helper instead of " +
    "reading entire files."
);

const memoryIndex = await readIfExists(
  join(cwd, ".claude", "claudepilot", "memory", "MEMORY.md")
);
if (memoryIndex) {
  lines.push("");
  lines.push("Persistent memory for this project (load only the bodies you need):");
  lines.push("");
  lines.push(memoryIndex.trim());
} else {
  lines.push("");
  lines.push(
    "No project memory yet. As you make durable decisions, record them with " +
      "/claudepilot:remember so the next session does not start from zero."
  );
}

const output = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: lines.join("\n")
  }
};

process.stdout.write(JSON.stringify(output));

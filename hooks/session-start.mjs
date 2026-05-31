#!/usr/bin/env node
// claudepilot SessionStart hook.
//
// It opens every session token-efficient and memory-aware. It loads the project
// memory index (the MEMORY.md the memory store maintains) so durable facts
// survive across sessions without re-reading the codebase, and it nudges Claude
// Code to read the compact project map before opening whole files.
//
// Output is the additionalContext field of a hookSpecificOutput object, which
// Claude Code injects into the session. The script never throws: a hook that
// crashes would block the session, so every failure path degrades to a hint.

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const cwd = process.cwd();

async function readIfExists(path) {
  try {
    await stat(path);
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

const lines = [];
lines.push("claudepilot is active in this project.");
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

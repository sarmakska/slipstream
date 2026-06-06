#!/usr/bin/env node
// slipstream SessionStart hook.
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
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readPayload, sessionId, emit, withLatencyGuard } from "./emit.mjs";

const execFileAsync = promisify(execFile);
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

// Build the task signal that drives smart recall: the git branch, the files
// changed in the working tree, and the last prompt the host passed. All cheap
// to gather and none requires reading file contents.
async function taskSignal(payload) {
  const signal = {};
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
    const branch = stdout.trim();
    if (branch && branch !== "HEAD") signal.branch = branch;
  } catch {
    /* not a git repo */
  }
  try {
    const { stdout } = await execFileAsync("git", ["diff", "--name-only", "HEAD"], { cwd });
    const files = stdout.split("\n").map((s) => s.trim()).filter(Boolean);
    if (files.length) signal.changedFiles = files.slice(0, 40);
  } catch {
    /* no diff */
  }
  if (typeof payload.prompt === "string" && payload.prompt.trim()) {
    signal.lastPrompt = payload.prompt.trim();
  }
  return signal;
}

await withLatencyGuard("session-start", async () => {
const payload = await readPayload();
const session = sessionId(payload);

// Boot the dashboard. We import the compiled launcher directly so we can read
// back the chosen url; if dist is not built yet (dev checkout) this is skipped.
let dashboardLine = null;
try {
  const launch = await import(pathToFileURL(join(here, "..", "dist", "dashboard", "index.js")).href);
  const settings = await launch.loadSettings(cwd);
  if (settings.enabled) {
    const result = await launch.startDashboard({
      projectRoot: cwd,
      session,
      detached: true
    });
    // Open the dashboard on every session start, not only the first, so a new
    // session always surfaces it. Disable with SLIPSTREAM_DASHBOARD_OPEN=0.
    if (settings.autoOpen) launch.openInBrowser(result.url);
    dashboardLine =
      `Live agent dashboard: ${result.url} ` +
      (result.started ? "(just started)" : "(already running)") +
      ". It streams this session locally; nothing leaves the machine.";
  }
} catch {
  // No dashboard available in this checkout; carry on.
}

await emit({ session, kind: "session-start", label: "session started" });

const lines = [];
lines.push("slipstream is active in this project.");
if (dashboardLine) {
  lines.push("");
  lines.push(dashboardLine);
}

// Cold start: always build and inject the full app knowledge first, so Claude
// opens every session knowing what the project is, how it is organised, the
// files everything flows through, what was built last and what is remembered.
try {
  const brief = await import(pathToFileURL(join(here, "..", "dist", "dashboard", "brief.js")).href);
  const feed = await brief.knowledgeFeed(cwd);
  if (feed && feed.trim()) {
    lines.push("");
    lines.push("Project knowledge (built fresh this session):");
    lines.push(feed);
  }
} catch {
  // No dist or no project to read: skip the knowledge feed.
}

// Where we left off: reconstruct the open thread and files in flight from the
// captured conversation and observations so the session resumes warm. The same
// brief is shown on the dashboard Overview, so the two never disagree.
try {
  const memory = await import(pathToFileURL(join(here, "..", "dist", "memory", "index.js")).href);
  const conv = await memory.loadConversation(cwd, String(session)).catch(() => null);
  const allObs = await memory.loadObservations(cwd).catch(() => []);
  const sessionObs = allObs.filter((o) => o.session === String(session));
  const brief = memory.resumeBrief(conv, sessionObs);
  if (brief.hasContext) {
    lines.push("");
    lines.push("Where you left off:");
    if (brief.openThread) lines.push(`- Open thread: ${brief.openThread}`);
    if (brief.filesInFlight.length) lines.push(`- Files in flight: ${brief.filesInFlight.join(", ")}`);
    lines.push(`- Suggested next: ${brief.suggestedNext}`);
  }
  // Cross-tab coordination: surface what other open sessions are working on.
  const busNote = memory.renderBus(await memory.loadBus(cwd), String(session));
  if (busNote) { lines.push(""); lines.push(busNote); }
} catch {
  // No dist or no history: skip the resume and coordination blocks.
}

lines.push("");
lines.push("Token discipline: prefer the project map over whole files.");
lines.push(
  "Run /slipstream:map to refresh .claude/slipstream/map.md, read that index, " +
    "then pull single symbols or line ranges with the slice helper instead of " +
    "reading entire files."
);

const memoryIndex = await readIfExists(
  join(cwd, ".claude", "slipstream", "memory", "MEMORY.md")
);
if (memoryIndex) {
  // Smart recall: rank the store against the task signal and reload only the
  // relevant subset, plus the index for the rest. This is the whole point: we
  // never dump the entire store into context.
  let recallBlock = "";
  let digestBlock = "";
  try {
    const memory = await import(pathToFileURL(join(here, "..", "dist", "memory", "index.js")).href);
    const all = await memory.listMemories(cwd);

    // Reload this session's most recent compaction digest first, so a resumed
    // session picks the thread straight back up.
    const digestName = memory.digestMemoryName(session);
    const digest = all.find((m) => m.name === digestName) ||
      all.find((m) => (m.tags ?? []).includes("session-digest"));
    if (digest) {
      digestBlock =
        "Last compaction digest (reloaded so the thread survives):\n\n" +
        `### ${digest.name}\n${digest.body}`;
    }

    const signal = await taskSignal(payload);
    const hits = memory.selectRelevant(
      all.filter((m) => !(m.tags ?? []).includes("session-digest")),
      signal
    );
    recallBlock = memory.renderRecall(hits);
  } catch {
    /* dev checkout without dist: fall back to the index */
  }

  if (digestBlock) {
    lines.push("");
    lines.push(digestBlock);
  }
  if (recallBlock) {
    lines.push("");
    lines.push(recallBlock);
  }
  lines.push("");
  lines.push("Full memory index (load only the bodies you need):");
  lines.push("");
  lines.push(memoryIndex.trim());
} else {
  lines.push("");
  lines.push(
    "No project memory yet. As you make durable decisions, record them with " +
      "/slipstream:remember so the next session does not start from zero."
  );
}

const output = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: lines.join("\n")
  }
};

process.stdout.write(JSON.stringify(output));
});

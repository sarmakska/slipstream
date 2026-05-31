// Shared helper for the claudepilot dashboard hooks.
//
// Each lifecycle hook reads its JSON payload from stdin, derives a session id
// and a short redacted label, and appends one event to the project event log by
// shelling out to the bundled helper CLI. We go through the CLI rather than
// importing the compiled modules so the hooks have no relative path coupling to
// dist/ layout, and so a hook can never crash the session: every failure path
// is swallowed.

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "dist", "cli", "index.js");

export async function readPayload() {
  let data = "";
  try {
    for await (const chunk of process.stdin) data += chunk;
  } catch {
    return {};
  }
  try {
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function sessionId(payload) {
  return (
    payload.session_id ||
    process.env.CLAUDE_SESSION_ID ||
    "main"
  );
}

// Fire-and-forget append. Detached so the hook returns immediately and never
// blocks the agent; errors are intentionally ignored.
export function emit({ kind, label, agent = "main", session, bytes }) {
  const args = [
    cli,
    "dashboard",
    "emit",
    "--root",
    process.cwd(),
    "--session",
    String(session ?? "main"),
    "--agent",
    String(agent),
    "--kind",
    String(kind),
    "--label",
    String(label ?? "").slice(0, 480)
  ];
  if (typeof bytes === "number" && Number.isFinite(bytes)) {
    args.push("--bytes", String(Math.round(bytes)));
  }
  try {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: "ignore"
    });
    child.unref();
  } catch {
    // Never let event emission break the session.
  }
}

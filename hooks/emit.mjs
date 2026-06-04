// Shared helper for the slipstream dashboard hooks.
//
// Each lifecycle hook reads its JSON payload from stdin, derives a session id
// and a short redacted label, and appends one event to the project event log.
// The write happens in-process via the compiled appendEvent, and emit() is async
// so a hook can await it before exiting: a fire-and-forget detached child does
// not survive the parent's immediate process.exit on Windows, which silently
// dropped every hook event. A hook can never crash the session: every failure
// path is swallowed and a dev checkout without dist degrades emit() to a no-op.

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Resolve a path under the plugin to a file:// URL. On Windows a dynamic
// import() of a bare absolute path ("C:\\...") is parsed as a "c:" URL scheme
// and throws, so every dist import the hooks do must go through this.
function distUrl(...segments) {
  return pathToFileURL(join(here, "..", "dist", ...segments)).href;
}

// Lazily load the compiled writer once per process. Resolves to null in a dev
// checkout that has not been built, so emit() becomes a safe no-op.
let writerPromise = null;
function loadWriter() {
  if (!writerPromise) {
    writerPromise = (async () => {
      try {
        const log = await import(distUrl("dashboard", "log.js"));
        const events = await import(distUrl("dashboard", "events.js"));
        return { appendEvent: log.appendEvent, makeEvent: events.makeEvent };
      } catch {
        return null;
      }
    })();
  }
  return writerPromise;
}

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

// Latency guard. Wraps a hook handler so that any handler exceeding the
// configured budget logs a one-line warning to stderr with the hook name and
// elapsed ms. The default budget is 200ms, overridable with
// SLIPSTREAM_HOOK_BUDGET_MS. A throw is rethrown unchanged; the timer never
// swallows errors.
export async function withLatencyGuard(name, fn) {
  const budget = Number(process.env.SLIPSTREAM_HOOK_BUDGET_MS) || 200;
  const start = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (elapsedMs > budget) {
      process.stderr.write(
        `[slipstream] hook ${name} took ${elapsedMs.toFixed(1)}ms (budget ${budget}ms)\n`
      );
    }
  }
}

// Append one event in-process. Async on purpose: callers await it so the write
// completes before the hook exits. Errors are swallowed so emission can never
// break the session.
export async function emit({ kind, label, agent = "main", session, bytes }) {
  try {
    const writer = await loadWriter();
    if (!writer) return;
    const data =
      typeof bytes === "number" && Number.isFinite(bytes)
        ? { bytes: Math.round(bytes) }
        : undefined;
    await writer.appendEvent(
      process.cwd(),
      writer.makeEvent({
        session: String(session ?? "main"),
        agent: String(agent),
        kind: String(kind),
        label: String(label ?? "").slice(0, 480),
        data
      })
    );
  } catch {
    // Never let event emission break the session.
  }
}

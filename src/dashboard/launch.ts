/**
 * Starting and stopping the dashboard from the outside. The SessionStart hook
 * calls startDashboard; the same function powers `slipstream dashboard start`.
 *
 * Idempotency is the tricky part. Several SessionStart hooks can fire across a
 * working day (startup, resume, a reload), and each must reuse the running
 * server, not spawn another. We record the server's pid, port and url in
 * server.json. A new start reads that file, checks the recorded server is
 * actually alive and actually listening on its port, and if so just returns the
 * existing url. Only when there is no live server do we spawn a detached one.
 */

import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DashboardServer } from "./server.js";
import {
  readServerInfo,
  writeServerInfo,
  clearServerInfo,
  type ServerInfo
} from "./log.js";

const here = dirname(fileURLToPath(import.meta.url));

/** True if a process with this pid exists and we may signal it. */
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH: gone. EPERM: alive but not ours; treat as alive.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** True if something is listening on 127.0.0.1:port within the timeout. */
function portListening(port: number, timeoutMs = 300): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const done = (ok: boolean): void => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

/** Confirm the recorded server is genuinely running, else clear the record. */
export async function liveServer(
  projectRoot: string
): Promise<ServerInfo | null> {
  const info = await readServerInfo(projectRoot);
  if (!info) return null;
  if (pidAlive(info.pid) && (await portListening(info.port))) return info;
  await clearServerInfo(projectRoot);
  return null;
}

export interface StartResult {
  url: string;
  port: number;
  started: boolean; // false means we reused a live server
}

/**
 * Start the dashboard for a project, or return the live one. When `detached` is
 * true (the hook path) we spawn a separate process that outlives the hook; when
 * false (tests, foreground) we start an in-process server and return it so the
 * caller can close it.
 */
export async function startDashboard(options: {
  projectRoot: string;
  session?: string;
  detached?: boolean;
}): Promise<StartResult & { server?: DashboardServer }> {
  const existing = await liveServer(options.projectRoot);
  if (existing) {
    return { url: existing.url, port: existing.port, started: false };
  }

  if (options.detached) {
    return spawnDetached(options.projectRoot, options.session);
  }

  const server = new DashboardServer({
    projectRoot: options.projectRoot,
    session: options.session
  });
  const port = await server.listen();
  await writeServerInfo(options.projectRoot, {
    pid: process.pid,
    port,
    url: server.url(),
    startedAt: new Date().toISOString()
  });
  return { url: server.url(), port, started: true, server };
}

/**
 * Spawn the bundled runner as a detached child so it survives the short-lived
 * hook process. The child writes server.json once it is listening; we poll that
 * file briefly so we can print the real url back into the chat.
 */
async function spawnDetached(
  projectRoot: string,
  session?: string
): Promise<StartResult> {
  const runner = join(here, "runner.js");
  const args = [runner, "--root", projectRoot];
  if (session) args.push("--session", session);
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  // Wait for the child to advertise itself, up to ~3s.
  for (let i = 0; i < 30; i += 1) {
    const info = await liveServer(projectRoot);
    if (info) return { url: info.url, port: info.port, started: true };
    await new Promise((r) => setTimeout(r, 100));
  }
  // It may still be coming up; return a best-effort placeholder.
  const info = await readServerInfo(projectRoot);
  return {
    url: info?.url ?? "http://127.0.0.1:(starting)",
    port: info?.port ?? 0,
    started: true
  };
}

/** Open a url in the default browser, best-effort and non-fatal. */
export function openInBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // No browser, headless box, sandboxed: the url is printed in chat anyway.
  }
}

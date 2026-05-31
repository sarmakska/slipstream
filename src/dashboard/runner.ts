#!/usr/bin/env node
/**
 * The detached dashboard process. startDashboard spawns this with --root and an
 * optional --session; it binds a free port, records server.json, and stays up
 * until the socket is closed or the process is told to quit. On exit it clears
 * server.json so the next SessionStart knows to spawn afresh.
 *
 * This file is the only one in the dashboard that is its own process entry
 * point, which is why it lives apart from server.ts.
 */

import { DashboardServer } from "./server.js";
import { writeServerInfo, clearServerInfo } from "./log.js";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main(): Promise<void> {
  const projectRoot = flag("root") ?? process.cwd();
  const session = flag("session");
  const server = new DashboardServer({ projectRoot, session });
  const port = await server.listen();
  await writeServerInfo(projectRoot, {
    pid: process.pid,
    port,
    url: server.url(),
    startedAt: new Date().toISOString()
  });

  const shutdown = async (): Promise<void> => {
    await clearServerInfo(projectRoot);
    await server.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Keep the event loop alive for the lifetime of the server.
  setInterval(() => {}, 1 << 30);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

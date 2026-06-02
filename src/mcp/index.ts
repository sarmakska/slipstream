#!/usr/bin/env node
/**
 * Entry point for the bundled slipstream MCP server. Claude Code spawns this
 * over stdio (see the mcpServers block in .claude-plugin/plugin.json). The
 * project root is the directory Claude Code launches it in, which is the user's
 * project, so the default root is the process cwd.
 */

import { runStdioServer } from "./server.js";

export * from "./server.js";
export * from "./tools.js";

// Only run the transport when invoked as the entry module, not when imported.
// Normalise path separators: on Windows process.argv[1] uses backslashes, so a
// raw endsWith("mcp/index.js") never matches and the server would exit silently.
const entryPath = process.argv[1]?.replace(/\\/g, "/");
const invokedDirectly =
  entryPath !== undefined &&
  (entryPath.endsWith("mcp/index.js") || entryPath.endsWith("mcp/index.ts"));

if (invokedDirectly) {
  runStdioServer({ defaultRoot: process.cwd() }).catch((error) => {
    process.stderr.write(`slipstream mcp server crashed: ${String(error)}\n`);
    process.exit(1);
  });
}

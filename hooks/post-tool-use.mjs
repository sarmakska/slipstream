#!/usr/bin/env node
// slipstream PostToolUse hook.
//
// Records that a tool call finished and, when the tool was a file read, how many
// bytes it pulled into context. The dashboard turns those bytes into an
// approximate per-agent token figure so you can watch the budget fill in real
// time. Like the other dashboard hooks it never blocks and never throws.

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readPayload, sessionId, emit, withLatencyGuard } from "./emit.mjs";

const here = dirname(fileURLToPath(import.meta.url));

await withLatencyGuard("post-tool-use", async () => {
  const payload = await readPayload();
  const session = sessionId(payload);
  const toolName = payload.tool_name ?? "tool";
  const input = payload.tool_input ?? {};
  const response = payload.tool_response ?? payload.tool_output ?? {};
  const target = input.file_path ?? input.path ?? "";

  // Estimate the bytes this call added to context. A read response usually carries
  // the file text; fall back to the file content field if present.
  let bytes = 0;
  const text =
    typeof response === "string"
      ? response
      : typeof response.content === "string"
        ? response.content
        : typeof response.output === "string"
          ? response.output
          : "";
  if (text) bytes = Buffer.byteLength(text, "utf8");

  await emit({
    session,
    kind: "post-tool",
    label: `${toolName} ${target}`.trim() || `${toolName} done`,
    bytes
  });

  // Live presence: when a file tool touches a file, refresh this session's bus
  // heartbeat so the dashboard shows what it is working on right now. Carries
  // the prior thread; appends the touched file. Silent on a dev checkout.
  if (target) {
    try {
      const memory = await import(pathToFileURL(join(here, "..", "dist", "memory", "index.js")).href);
      const mine = (await memory.loadBus(process.cwd())).filter((e) => e.session === String(session)).pop();
      const thread = mine?.thread || `${toolName}`.toLowerCase();
      const files = [...(mine?.files ?? []), target];
      await memory.postStatus(
        process.cwd(),
        memory.heartbeatEntry(String(session), thread, files, new Date().toISOString(), toolName)
      );
    } catch {
      // No dist build, or bus write failed: never break the session.
    }
  }
});

process.exit(0);

#!/usr/bin/env node
// claudepilot PostToolUse hook.
//
// Records that a tool call finished and, when the tool was a file read, how many
// bytes it pulled into context. The dashboard turns those bytes into an
// approximate per-agent token figure so you can watch the budget fill in real
// time. Like the other dashboard hooks it never blocks and never throws.

import { readPayload, sessionId, emit } from "./emit.mjs";

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

emit({
  session,
  kind: "post-tool",
  label: `${toolName} ${target}`.trim() || `${toolName} done`,
  bytes
});

process.exit(0);

#!/usr/bin/env node
// slipstream PreToolUse hook for the Read tool.
//
// It enforces the token discipline at the moment it matters: just before a file
// is read. If the target file is large and the agent is about to read the whole
// thing (no offset or limit), it warns and points at scoped retrieval. It does
// not hard block, because there are legitimate whole-file reads; it surfaces the
// cost so the agent can choose a slice instead. The threshold matches
// LARGE_FILE_BYTES in src/context/budget.ts.

import { stat } from "node:fs/promises";
import { readPayload, sessionId, emit } from "./emit.mjs";

const LARGE_FILE_BYTES = 16000;
const BYTES_PER_TOKEN = 3.6;

async function main() {
  const payload = await readPayload();
  const session = sessionId(payload);
  const toolName = payload.tool_name ?? "Read";

  const input = payload.tool_input ?? {};
  const targetLabel = input.file_path ?? input.path ?? "";
  emit({
    session,
    kind: "pre-tool",
    label: `${toolName} ${targetLabel}`.trim()
  });

  const filePath = input.file_path ?? input.path;
  if (!filePath) process.exit(0);

  // A scoped read already, leave it alone.
  if (input.offset !== undefined || input.limit !== undefined) {
    process.exit(0);
  }

  let bytes = 0;
  try {
    bytes = (await stat(filePath)).size;
  } catch {
    process.exit(0);
  }

  if (bytes <= LARGE_FILE_BYTES) process.exit(0);

  const approxTokens = Math.round(bytes / BYTES_PER_TOKEN);
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      additionalContext:
        `slipstream: ${filePath} is large (about ${approxTokens} tokens). ` +
        "Consider reading the project map first, then pulling the specific " +
        "symbol or a line range instead of the whole file to protect your " +
        "context budget."
    }
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main();

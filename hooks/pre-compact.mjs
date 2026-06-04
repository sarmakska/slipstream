#!/usr/bin/env node
// slipstream PreCompact hook: lossless compaction.
//
// Claude Code fires PreCompact just before it summarises and trims the
// conversation. That is the moment the thread is most likely to get lost. This
// hook builds a structured digest (open task, decisions, files touched, next
// steps) from the events the dashboard already recorded this session, writes it
// to the memory store as a durable fact, and emits a dashboard event so the
// compaction is visible. On the next SessionStart the digest is reloaded, so
// the working context survives the compaction intact.
//
// The hook never throws: a PreCompact handler that crashes could interfere with
// compaction, so every failure path degrades to a no-op.

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readPayload, sessionId, emit, withLatencyGuard } from "./emit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

await withLatencyGuard("pre-compact", async () => {
const payload = await readPayload();
const session = sessionId(payload);
// Claude Code reports the trigger: "manual" for /compact, "auto" when the
// window fills. The custom instructions (if any) are a good open-task hint.
const trigger = payload.trigger === "manual" ? "manual" : "auto";
const openTaskHint =
  typeof payload.custom_instructions === "string" && payload.custom_instructions.trim()
    ? payload.custom_instructions.trim()
    : undefined;

try {
  const dash = await import(pathToFileURL(join(here, "..", "dist", "dashboard", "index.js")).href);
  const memory = await import(pathToFileURL(join(here, "..", "dist", "memory", "index.js")).href);

  // Reconstruct what happened this session from the append-only log.
  const events = await dash.readLog(cwd, session).catch(() => []);
  const activity = events.map((e) => e.label).filter(Boolean);
  const filesTouched = [
    ...new Set(
      events
        .filter((e) => e.kind === "pre-tool" || e.kind === "post-tool")
        .map((e) => {
          const m = /([\w./-]+\.[a-z]{1,5})\b/.exec(e.label || "");
          return m ? m[1] : null;
        })
        .filter(Boolean)
    )
  ];

  const digest = memory.buildDigest({
    session,
    trigger,
    activity,
    filesTouched,
    openTaskHint
  });
  const saved = await memory.addMemory(cwd, memory.digestToMemory(digest));

  await emit({
    session,
    kind: "stop",
    label: `compaction (${trigger}): saved digest ${saved.name}`,
    bytes: 0
  });

  const output = {
    hookSpecificOutput: {
      hookEventName: "PreCompact",
      additionalContext:
        `slipstream saved a compaction digest ("${digest.openTask}") to memory ` +
        `as ${saved.name}. It will be reloaded on the next session so the thread ` +
        `is not lost.`
    }
  };
  process.stdout.write(JSON.stringify(output));
} catch {
  // No dist build or no log: nothing to digest. Stay silent.
}
});
process.exit(0);

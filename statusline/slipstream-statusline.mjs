#!/usr/bin/env node
// slipstream statusline.
//
// Claude Code invokes this on each render and pipes a JSON object on stdin
// describing the session. We print one line for the status bar: the context
// budget level, the durable memory count for the project, the active skill or
// output style, and the model. We go through the compiled helper so the
// formatting lives in one place and is unit-tested; if dist is missing (a dev
// checkout that has not built) we degrade to a minimal line rather than error,
// because a statusline must never crash the editor.

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "dist", "cli", "index.js");

let payload = {};
try {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  if (data.trim()) payload = JSON.parse(data);
} catch {
  payload = {};
}

const cwd =
  payload.workspace?.current_dir ||
  payload.cwd ||
  process.env.CLAUDE_PROJECT_DIR ||
  process.cwd();

// Claude Code reports rough transcript size on some payloads; fall back to 0.
const bytes =
  Number(payload.cost?.total_tokens_used ? payload.cost.total_tokens_used * 3.6 : 0) || 0;

const model = payload.model?.display_name || payload.model?.id || "";
const skill = payload.active_skill || process.env.SLIPSTREAM_ACTIVE_SKILL || "";
// Claude Code passes the path to the session transcript, whose latest message
// carries a real token-usage block. Handing it to the helper lets the budget
// reflect the true context window, not just the bytes slipstream served.
const transcript = payload.transcript_path || "";

const args = ["statusline", "--root", cwd];
if (bytes) args.push("--bytes", String(Math.round(bytes)));
if (skill) args.push("--skill", String(skill));
if (model) args.push("--model", String(model));
if (transcript) args.push("--transcript", String(transcript));

const res = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
if (res.status === 0 && res.stdout.trim()) {
  process.stdout.write(res.stdout.trim());
} else {
  process.stdout.write("cp | ctx 0% ok");
}

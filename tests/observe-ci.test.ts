import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { appendEvent } from "../src/dashboard/log.js";
import { makeEvent } from "../src/dashboard/events.js";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "dist", "cli", "index.js");

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "slipstream-ci-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("slipstream observe --ci", () => {
  it("emits one JSON line per captured observation to stdout", async () => {
    await appendEvent(
      root,
      makeEvent({ session: "s1", agent: "main", kind: "session-start", label: "boot" })
    );
    await appendEvent(
      root,
      makeEvent({ session: "s1", agent: "main", kind: "user-prompt", label: "hello" })
    );
    await appendEvent(
      root,
      makeEvent({ session: "s1", agent: "main", kind: "stop", label: "done" })
    );

    const result = spawnSync(
      process.execPath,
      [cli, "observe", "--root", root, "--session", "s1", "--ci"],
      { encoding: "utf8" }
    );
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    for (const line of lines) {
      const obj = JSON.parse(line);
      expect(typeof obj.id).toBe("number");
      expect(typeof obj.summary).toBe("string");
    }
  });

  it("does not boot a dashboard or open a socket", async () => {
    // Nothing on disk yet: a clean --ci run must exit zero and emit nothing
    // rather than start a server or wait for connections.
    const result = spawnSync(
      process.execPath,
      [cli, "observe", "--root", root, "--session", "s1", "--ci"],
      { encoding: "utf8", timeout: 5000 }
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Regression guard for the Windows fire-and-forget bug: hooks used to emit by
// spawning a detached child and then exiting immediately, so the write never
// happened and the dashboard/observation store stayed empty. The hooks now write
// in-process and await the write before exit. This drives the real .mjs hook as a
// child process — the only way to catch the exit race and the Windows dynamic
// import() path issue (a bare "C:\\..." path needs a file:// URL).
const here = dirname(fileURLToPath(import.meta.url));
const hook = join(here, "..", "hooks", "post-tool-use.mjs");

describe("hooks persist events before the process exits", () => {
  it("post-tool-use writes the event to the log and survives immediate exit", async () => {
    const root = await mkdtemp(join(tmpdir(), "slipstream-hook-emit-"));
    try {
      const payload = JSON.stringify({
        session_id: "hookemit",
        tool_name: "Edit",
        tool_input: { file_path: "lib/foo.ts" },
        tool_response: { content: "abc" }
      });
      const res = spawnSync(process.execPath, [hook], {
        cwd: root,
        input: payload,
        encoding: "utf8"
      });
      expect(res.status).toBe(0);

      const log = join(root, ".claude", "slipstream", "dashboard", "hookemit.jsonl");
      const text = await readFile(log, "utf8");
      const line = text.trim().split("\n").filter(Boolean)[0] ?? "";
      const event = JSON.parse(line) as { kind: string; label: string };
      expect(event.kind).toBe("post-tool");
      expect(event.label).toContain("lib/foo.ts");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

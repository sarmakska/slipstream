import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEvent } from "../src/dashboard/log.js";
import { makeEvent } from "../src/dashboard/events.js";
import {
  buildReplayBundle,
  exportReplay
} from "../src/dashboard/export.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "slipstream-export-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("replay export", () => {
  it("produces a manifest covering transcript, state and observations", async () => {
    await appendEvent(
      root,
      makeEvent({ session: "s1", agent: "main", kind: "session-start", label: "boot" })
    );
    await appendEvent(
      root,
      makeEvent({ session: "s1", agent: "main", kind: "user-prompt", label: "hi" })
    );
    await appendEvent(
      root,
      makeEvent({ session: "s1", agent: "main", kind: "stop", label: "done" })
    );

    const bundle = await buildReplayBundle({
      projectRoot: root,
      sessionId: "s1",
      withMap: false,
      now: () => new Date("2026-06-04T12:00:00Z")
    });

    expect(bundle.manifest.session).toBe("s1");
    expect(bundle.manifest.version).toBe(1);
    expect(bundle.manifest.exportedAt).toBe("2026-06-04T12:00:00.000Z");

    const paths = bundle.manifest.files.map((f) => f.path);
    expect(paths).toContain("transcript.jsonl");
    expect(paths).toContain("state.json");
    expect(paths).toContain("observations.jsonl");

    for (const entry of bundle.manifest.files) {
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(typeof entry.bytes).toBe("number");
    }
  });

  it("writes a real zip whose central directory holds every manifest entry", async () => {
    await appendEvent(
      root,
      makeEvent({ session: "s1", agent: "main", kind: "stop", label: "done" })
    );
    const out = join(root, "replay.zip");
    const manifest = await exportReplay(out, {
      projectRoot: root,
      sessionId: "s1",
      withMap: false
    });

    const buf = await readFile(out);
    // The EOCD signature appears in the last 22 bytes of a zip with no comment.
    const eocd = buf.readUInt32LE(buf.length - 22);
    expect(eocd).toBe(0x06054b50);
    const totalEntries = buf.readUInt16LE(buf.length - 22 + 10);
    // Manifest counts the data files; the zip also includes manifest.json.
    expect(totalEntries).toBe(manifest.files.length + 1);
  });
});

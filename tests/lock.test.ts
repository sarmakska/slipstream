import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, utimes, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withFileLock } from "../src/util/lock.js";
import { appendEvent, readLog, readLogSince, logPath } from "../src/dashboard/log.js";
import { makeEvent } from "../src/dashboard/events.js";

describe("withFileLock", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "slipstream-lock-"));
    file = join(dir, "target.jsonl");
    await writeFile(file, "", "utf8");
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reports the lock as held when uncontended, and releases it after", async () => {
    const held = await withFileLock(file, async (h) => h);
    expect(held).toBe(true);
    await expect(stat(`${file}.lock`)).rejects.toThrow();
  });

  it("never lets two lock-HOLDING sections overlap", async () => {
    // The contract is not strict mutual exclusion - the lock is best-effort and
    // a caller that times out runs anyway. What must hold is that everyone who
    // was told `held` is genuinely alone.
    let holders = 0;
    let maxHolders = 0;
    await Promise.all(
      Array.from({ length: 12 }, () =>
        withFileLock(file, async (held) => {
          if (!held) return;
          holders++;
          maxHolders = Math.max(maxHolders, holders);
          await new Promise((r) => setTimeout(r, 5));
          holders--;
        }, { timeoutMs: 8000, staleMs: 30_000 })
      )
    );
    expect(maxHolders).toBe(1);
  });

  it("reclaims a stale marker instead of wedging until the timeout", async () => {
    // A marker left behind by a process that died holding the lock.
    const lock = `${file}.lock`;
    await writeFile(lock, "", "utf8");
    const old = new Date(Date.now() - 60_000);
    await utimes(lock, old, old);

    const started = Date.now();
    const held = await withFileLock(file, async (h) => h, { timeoutMs: 1500, staleMs: 1000 });

    // Previously staleMs (5000) exceeded the default timeout (1500), so this
    // path was unreachable and the call fell through unlocked.
    expect(held).toBe(true);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("still runs the critical section when the lock cannot be taken", async () => {
    const lock = `${file}.lock`;
    await writeFile(lock, "", "utf8"); // fresh, so never reclaimed
    let ran = false;
    const held = await withFileLock(
      file,
      async (h) => {
        ran = true;
        return h;
      },
      { timeoutMs: 60, staleMs: 30_000 }
    );
    // Best-effort by design: a hook must never block the agent.
    expect(ran).toBe(true);
    expect(held).toBe(false);
    // A lock we never held must not be deleted out from under its owner.
    await expect(stat(lock)).resolves.toBeTruthy();
  });
});

describe("dashboard log sequencing", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "slipstream-seq-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const draft = (label: string) =>
    makeEvent({ session: "s", agent: "main", kind: "post-tool", label });

  it("numbers concurrent appends uniquely", async () => {
    await Promise.all(Array.from({ length: 25 }, (_, i) => appendEvent(root, draft(`e${i}`))));
    const log = await readLog(root, "s");
    expect(log).toHaveLength(25);
    expect(new Set(log.map((e) => e.seq)).size).toBe(25);
    expect(log.map((e) => e.seq)).toEqual([...Array(25).keys()]);
  });

  it("repairs duplicate sequences already on disk", async () => {
    // Two writers that both ran without the lock and picked the same seq. Left
    // as written, state.ts would drop the second as already-folded.
    await appendEvent(root, draft("first"));
    const path = logPath(root, "s");
    const line = (await readFile(path, "utf8")).trim();
    await writeFile(path, `${line}\n${line.replace('"first"', '"second"')}\n`, "utf8");

    const log = await readLog(root, "s");
    expect(log.map((e) => e.label)).toEqual(["first", "second"]);
    expect(log.map((e) => e.seq)).toEqual([0, 1]);
    // The second event is now reachable by an incremental tail, as it should be.
    expect(await readLogSince(root, "s", 0)).toHaveLength(1);
  });
});

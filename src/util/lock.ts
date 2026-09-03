/**
 * A small cross-process advisory lock, shared by every store that needs one (the
 * dashboard event log, the observation counter, the savings aggregate). It was
 * duplicated in two places before; keeping a single implementation means the
 * concurrency behaviour — and its one subtle rule — lives in exactly one file.
 *
 * The rule: a hook or tool call must never block the agent, so this is
 * best-effort. We spin on exclusively creating an O_EXCL marker; if we cannot get
 * it within the timeout we run anyway and let the caller proceed, because a
 * dropped write is worse than a rare duplicate. A stale marker from a crashed
 * process is reclaimed after a few seconds so nothing wedges forever.
 *
 * Because the lock can be skipped, no caller may depend on it for correctness.
 * Anything that must be unique has to be derivable without it - the dashboard log
 * numbers events by their position on read rather than trusting the seq written
 * under the lock, for exactly this reason.
 */

import { open, rm, stat } from "node:fs/promises";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface LockOptions {
  /** How long to keep trying before giving up and running anyway. */
  timeoutMs?: number;
  /** A marker older than this is assumed to be from a crashed process. */
  staleMs?: number;
}

/**
 * Run `fn` while holding a best-effort advisory lock on `file` (via `file.lock`).
 *
 * `fn` receives whether the lock was actually held, so a caller whose critical
 * section cannot tolerate contention can react instead of assuming exclusivity.
 * It runs either way - see the note at the top of this file.
 *
 * The default timeout must stay above `staleMs`, or the stale-marker sweep below
 * is unreachable and a crashed process wedges the file until something else
 * clears it. That was the case for a long time: the timeout was 1500ms against a
 * 5000ms stale threshold, so the reclaim path could never run.
 */
export async function withFileLock<T>(
  file: string,
  fn: (held: boolean) => Promise<T>,
  options: LockOptions | number = {}
): Promise<T> {
  // Two constraints pull against each other and both must hold.
  //
  // timeoutMs stays SHORT because a hook must never block the agent - that rule
  // outranks exclusivity, and raising it to seconds stalls real sessions.
  // staleMs must sit below timeoutMs or the reclaim below is unreachable (it was
  // 5000 against a 1500 timeout for a long time, so a crashed process wedged the
  // file), yet above the longest healthy critical section or a slow-but-alive
  // holder gets its lock stolen.
  //
  // 1s/1.5s satisfies both: the guarded sections here are a small read and a
  // single append, far under a second even on a loaded machine. It is safe to
  // cut this fine precisely because nothing depends on the lock for correctness
  // any more - see the note at the top.
  const { timeoutMs = 1500, staleMs = 1000 } =
    typeof options === "number" ? { timeoutMs: options } : options;

  const lock = `${file}.lock`;
  const deadline = Date.now() + timeoutMs;
  let held = false;
  while (Date.now() < deadline) {
    try {
      const handle = await open(lock, "wx");
      await handle.close();
      held = true;
      break;
    } catch {
      const age = await stat(lock)
        .then((s) => Date.now() - s.mtimeMs)
        .catch(() => null);

      // The marker vanished between our failed open and this stat, so the holder
      // released it. Retry immediately - do NOT treat this as stale. Reading a
      // missing file as infinitely old (the previous behaviour) meant we deleted
      // the marker, and by then a third caller may already have created its own:
      //
      //   A holds -> B's open fails -> A releases -> B stats, sees nothing
      //   -> C acquires -> B removes C's marker -> B acquires
      //
      // leaving B and C both convinced they held it, which is precisely what the
      // lock exists to prevent.
      if (age === null) continue;

      // A genuinely old marker is from a process that died holding it.
      if (age > staleMs) {
        await rm(lock).catch(() => {});
        continue;
      }
      // Jitter the backoff. Without it a burst of waiters wakes in lockstep and
      // collides on every retry, which is how contention turned into timeouts.
      await sleep(5 + Math.floor(Math.random() * 20));
    }
  }
  try {
    return await fn(held);
  } finally {
    if (held) await rm(lock).catch(() => {});
  }
}

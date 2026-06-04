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
 */

import { open, rm, stat } from "node:fs/promises";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Run `fn` while holding a best-effort advisory lock on `file` (via `file.lock`). */
export async function withFileLock<T>(
  file: string,
  fn: () => Promise<T>,
  timeoutMs = 1500
): Promise<T> {
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
      // A stale lock from a crashed process should not wedge us forever.
      const age = await stat(lock)
        .then((s) => Date.now() - s.mtimeMs)
        .catch(() => Infinity);
      if (age > 5000) {
        await rm(lock).catch(() => {});
        continue;
      }
      await sleep(15);
    }
  }
  try {
    return await fn();
  } finally {
    if (held) await rm(lock).catch(() => {});
  }
}

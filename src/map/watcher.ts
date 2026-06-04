/**
 * Map watcher. Watches the project map source files (the on-disk tree) and
 * fires a debounced callback when a change is detected, so the dashboard and
 * the observe loop can re-read the map without polling.
 *
 * Implementation uses `node:fs.watch` rather than chokidar because slipstream
 * already keeps its runtime dependency surface tiny and the watcher only needs
 * a single path change signal, not full glob coverage. A debounce of 500ms
 * coalesces editor-saves and bulk operations into one re-read.
 *
 * The factory function is exported as `createMapWatcher` so callers control
 * the lifetime; the debounce primitive is exported separately as `debounce` so
 * tests can assert the timing behaviour without needing a real filesystem.
 */

import { watch, type FSWatcher } from "node:fs";
import { resolve } from "node:path";

export interface DebounceHandle {
  (...args: unknown[]): void;
  /** Cancel a pending invocation. */
  cancel(): void;
  /** Flush a pending invocation immediately. */
  flush(): void;
}

/**
 * Trailing-edge debounce. Calls within `wait` ms collapse into one invocation
 * that fires `wait` ms after the last call. Exported so the tests can drive it
 * deterministically with `vi.useFakeTimers`.
 */
export function debounce(
  fn: (...args: unknown[]) => void,
  wait: number
): DebounceHandle {
  let timer: NodeJS.Timeout | null = null;
  let lastArgs: unknown[] | null = null;

  const wrapped = ((...args: unknown[]): void => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const a = lastArgs;
      lastArgs = null;
      if (a) fn(...a);
    }, wait);
  }) as DebounceHandle;

  wrapped.cancel = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  wrapped.flush = (): void => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    const a = lastArgs;
    lastArgs = null;
    if (a) fn(...a);
  };

  return wrapped;
}

export interface MapWatcherOptions {
  /** Project root the watcher observes. */
  root: string;
  /** Callback invoked after the debounce window with the changed path, if any. */
  onChange: (path: string | undefined) => void | Promise<void>;
  /** Debounce window in ms. Defaults to 500. */
  debounceMs?: number;
}

export interface MapWatcher {
  close(): void;
}

/**
 * Start watching the project root. Returns a handle whose `close()` releases
 * the underlying FSWatcher. Errors from the watcher are swallowed: a failed
 * watch must never crash the host process; the dashboard falls back to its
 * existing poll cadence.
 */
export function createMapWatcher(options: MapWatcherOptions): MapWatcher {
  const wait = options.debounceMs ?? 500;
  const fire = debounce((...args: unknown[]) => {
    const path = typeof args[0] === "string" ? args[0] : undefined;
    void Promise.resolve(options.onChange(path)).catch(() => {});
  }, wait);

  let watcher: FSWatcher | null = null;
  try {
    watcher = watch(
      resolve(options.root),
      { recursive: true },
      (_eventType, filename) => {
        fire(filename ?? undefined);
      }
    );
    watcher.on("error", () => {
      /* swallow */
    });
  } catch {
    watcher = null;
  }

  return {
    close(): void {
      fire.cancel();
      if (watcher) {
        try {
          watcher.close();
        } catch {
          /* swallow */
        }
      }
    }
  };
}

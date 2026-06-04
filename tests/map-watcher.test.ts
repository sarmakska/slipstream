import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce } from "../src/map/watcher.js";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires once after the trailing edge of a burst", () => {
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d();
    d();
    d();
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses the most recent args when it fires", () => {
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d("a");
    d("b");
    d("c");
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("cancel prevents the pending call", () => {
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d();
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});

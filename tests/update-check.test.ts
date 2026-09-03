import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkForUpdate, isNewer, renderUpdateNotice } from "../src/util/update-check.js";

/** A fetch that never touches the network and records how often it was called. */
function fakeFetch(version: string | null, ok = true) {
  const calls = { count: 0 };
  const impl = (async () => {
    calls.count++;
    if (version === null) throw new Error("offline");
    return {
      ok,
      json: async () => ({ version })
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("isNewer", () => {
  it("compares numerically, not lexically", () => {
    expect(isNewer("1.10.0", "1.9.0")).toBe(true);
    expect(isNewer("1.9.0", "1.10.0")).toBe(false);
    expect(isNewer("2.0.0", "1.99.99")).toBe(true);
  });

  it("is false for equal versions", () => {
    expect(isNewer("1.1.0", "1.1.0")).toBe(false);
  });

  it("handles missing segments", () => {
    expect(isNewer("1.1", "1.0.9")).toBe(true);
    expect(isNewer("1", "1.0.0")).toBe(false);
  });

  it("ignores pre-release suffixes so a beta never nags a stable user", () => {
    expect(isNewer("1.1.0-beta.1", "1.1.0")).toBe(false);
    expect(isNewer("1.2.0-rc.1", "1.1.0")).toBe(true);
  });
});

describe("checkForUpdate", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "slipstream-update-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const env = {} as Record<string, string | undefined>;

  it("reports a newer version", async () => {
    const { impl } = fakeFetch("1.2.0");
    const status = await checkForUpdate({ root, current: "1.1.0", fetchImpl: impl, env });
    expect(status).toEqual({ current: "1.1.0", latest: "1.2.0", behind: true });
  });

  it("says nothing when already current", async () => {
    const { impl } = fakeFetch("1.1.0");
    expect(await checkForUpdate({ root, current: "1.1.0", fetchImpl: impl, env })).toBeNull();
  });

  it("says nothing when the local build is ahead of the registry", async () => {
    const { impl } = fakeFetch("1.1.0");
    expect(await checkForUpdate({ root, current: "1.2.0", fetchImpl: impl, env })).toBeNull();
  });

  it("is silent and does not throw when offline", async () => {
    const { impl } = fakeFetch(null);
    expect(await checkForUpdate({ root, current: "1.1.0", fetchImpl: impl, env })).toBeNull();
  });

  it("is silent on a non-ok response", async () => {
    const { impl } = fakeFetch("1.2.0", false);
    expect(await checkForUpdate({ root, current: "1.1.0", fetchImpl: impl, env })).toBeNull();
  });

  it("hits the network once a day, then serves the cache", async () => {
    const { impl, calls } = fakeFetch("1.2.0");
    const t0 = 1_000_000;
    await checkForUpdate({ root, current: "1.1.0", fetchImpl: impl, now: t0, env });
    expect(calls.count).toBe(1);

    // Same day: cached, still reports the update, no second request.
    const again = await checkForUpdate({ root, current: "1.1.0", fetchImpl: impl, now: t0 + 60_000, env });
    expect(calls.count).toBe(1);
    expect(again?.latest).toBe("1.2.0");

    // A day later: checks again.
    await checkForUpdate({ root, current: "1.1.0", fetchImpl: impl, now: t0 + 25 * 60 * 60 * 1000, env });
    expect(calls.count).toBe(2);
  });

  it("force skips the cache", async () => {
    const { impl, calls } = fakeFetch("1.2.0");
    const t0 = 1_000_000;
    await checkForUpdate({ root, current: "1.1.0", fetchImpl: impl, now: t0, env });
    await checkForUpdate({ root, current: "1.1.0", fetchImpl: impl, now: t0, force: true, env });
    expect(calls.count).toBe(2);
  });

  it("caches the version, not the verdict, so upgrading stops the notice", async () => {
    const { impl } = fakeFetch("1.2.0");
    const t0 = 1_000_000;
    await checkForUpdate({ root, current: "1.1.0", fetchImpl: impl, now: t0, env });
    // The user updates; the same cache must now say nothing.
    const after = await checkForUpdate({ root, current: "1.2.0", fetchImpl: impl, now: t0 + 60_000, env });
    expect(after).toBeNull();
    const cache = JSON.parse(
      await readFile(join(root, ".claude", "slipstream", "update-check.json"), "utf8")
    );
    expect(cache.latest).toBe("1.2.0");
  });

  it("makes no request at all when SLIPSTREAM_NO_UPDATE_CHECK is set", async () => {
    const { impl, calls } = fakeFetch("1.2.0");
    const status = await checkForUpdate({
      root,
      current: "1.1.0",
      fetchImpl: impl,
      env: { SLIPSTREAM_NO_UPDATE_CHECK: "1" }
    });
    expect(status).toBeNull();
    expect(calls.count).toBe(0);
  });
});

describe("renderUpdateNotice", () => {
  it("names both install routes and the opt-out", () => {
    const line = renderUpdateNotice({ current: "1.1.0", latest: "1.2.0", behind: true });
    expect(line).toContain("1.2.0");
    expect(line).toContain("1.1.0");
    expect(line).toContain("/plugin update slipstream");
    expect(line).toContain("npm i -g slipstream@latest");
    expect(line).toContain("SLIPSTREAM_NO_UPDATE_CHECK=1");
  });
});

/**
 * Update check: tell the user, inside the session, when a newer slipstream is
 * published — and tell Claude how to install it, so "there is an update" and
 * "the update is applied" are the same conversation rather than something you
 * discover months later.
 *
 * THIS IS THE ONLY NETWORK CALL slipstream MAKES. It is a plain unauthenticated
 * GET to the npm registry for one package's version. Nothing about you, your
 * code or your sessions is sent, and nothing is uploaded ever. It is still a
 * network call in a tool that otherwise touches nothing, so:
 *
 *   - it is cached for 24h, so a day of sessions costs one request
 *   - it times out fast and fails silent - offline is a normal state, not an error
 *   - SLIPSTREAM_NO_UPDATE_CHECK=1 disables it completely
 *   - the README says all of this plainly
 *
 * Never let this block the agent. Every path returns rather than throws, and the
 * caller treats null as "no news".
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const REGISTRY = "https://registry.npmjs.org/slipstream/latest";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 1500;

export interface UpdateStatus {
  current: string;
  latest: string;
  /** True when latest is genuinely newer than current. */
  behind: boolean;
}

interface CacheFile {
  latest: string;
  checkedAt: number;
}

/**
 * Compare two semver-ish strings. Returns true when `latest` is newer than
 * `current`. Deliberately simple: numeric segments only, and any pre-release
 * suffix is ignored, because a pre-release should never nag a stable user.
 */
export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string): number[] =>
    v.split("-")[0]!.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

function cachePath(root: string): string {
  return join(resolve(root), ".claude", "slipstream", "update-check.json");
}

async function readCache(root: string): Promise<CacheFile | null> {
  try {
    return JSON.parse(await readFile(cachePath(root), "utf8")) as CacheFile;
  } catch {
    return null;
  }
}

async function writeCache(root: string, cache: CacheFile): Promise<void> {
  try {
    const path = cachePath(root);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, JSON.stringify(cache), "utf8");
  } catch {
    // A cache we cannot write just means we check again tomorrow.
  }
}

/** Fetch the published version. Null on any failure, including being offline. */
async function fetchLatest(fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(REGISTRY, {
        signal: controller.signal,
        headers: { accept: "application/vnd.npm.install-v1+json" }
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { version?: string };
      return typeof body.version === "string" ? body.version : null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export interface CheckOptions {
  root: string;
  current: string;
  /** Injected by tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected by tests; defaults to Date.now(). */
  now?: number;
  /** Skip the cache and ask the registry. */
  force?: boolean;
  /** Injected by tests; defaults to process.env. */
  env?: Record<string, string | undefined>;
}

/**
 * Returns the update status, or null when there is nothing to say - disabled,
 * offline, already current, or checked recently.
 */
export async function checkForUpdate(options: CheckOptions): Promise<UpdateStatus | null> {
  const {
    root,
    current,
    fetchImpl = globalThis.fetch,
    now = Date.now(),
    force = false,
    env = process.env
  } = options;

  if (env["SLIPSTREAM_NO_UPDATE_CHECK"]) return null;
  if (typeof fetchImpl !== "function") return null;

  const cached = await readCache(root);
  if (!force && cached && now - cached.checkedAt < CACHE_TTL_MS) {
    return isNewer(cached.latest, current)
      ? { current, latest: cached.latest, behind: true }
      : null;
  }

  const latest = await fetchLatest(fetchImpl);
  if (!latest) return null;

  await writeCache(root, { latest, checkedAt: now });
  return isNewer(latest, current) ? { current, latest, behind: true } : null;
}

/**
 * The line injected into the session feed. Addressed to Claude as much as to the
 * user: it names the exact command, so the agent can offer to run it rather than
 * leaving the reader to work out how slipstream was installed.
 */
export function renderUpdateNotice(status: UpdateStatus): string {
  return (
    `slipstream ${status.latest} is available (you are on ${status.current}). ` +
    `Update with \`/plugin update slipstream\` if it is installed as a Claude Code plugin, ` +
    `or \`npm i -g slipstream@latest\` if it is the standalone MCP server. ` +
    `Offer to run it; the changelog is at https://github.com/sarmakska/slipstream/releases. ` +
    `Set SLIPSTREAM_NO_UPDATE_CHECK=1 to stop checking.`
  );
}

/**
 * Replay export. Bundles a session's transcript, observations and a project
 * map snapshot into a single zip with a top-level `manifest.json` describing
 * what each entry is. The output is meant for sharing or archiving a complete
 * record of what one session did without needing the dashboard running.
 *
 * The function is split into a pure `buildReplayBundle` that returns a list of
 * file entries and an IO wrapper `exportReplay` that writes the zip to disk,
 * so tests can pin the manifest without touching the filesystem.
 */

import { readLog, listSessions } from "./log.js";
import { reduceEvents } from "./state.js";
import { loadObservations } from "../memory/index.js";
import { generateMap, mapToJson } from "../map/index.js";
import { writeZip, sha256 } from "./zip.js";
import { Buffer } from "node:buffer";

export interface ReplayManifest {
  version: number;
  session: string;
  exportedAt: string;
  files: { path: string; bytes: number; sha256: string; kind: string }[];
}

export interface ReplayBundle {
  manifest: ReplayManifest;
  files: { path: string; data: string }[];
}

export interface BuildOptions {
  projectRoot: string;
  sessionId: string;
  /** Override the clock for deterministic tests. */
  now?: () => Date;
  /** Skip the project map snapshot (useful in unit tests). */
  withMap?: boolean;
}

/**
 * Build the in-memory bundle for a replay export. Pure of disk writes: returns
 * the manifest plus a list of file entries the zip writer consumes.
 */
export async function buildReplayBundle(
  opts: BuildOptions
): Promise<ReplayBundle> {
  const now = opts.now ? opts.now() : new Date();
  const events = await readLog(opts.projectRoot, opts.sessionId);
  const state = reduceEvents(events);
  const observations = await loadObservations(opts.projectRoot, {
    session: opts.sessionId
  });

  const files: { path: string; data: string; kind: string }[] = [];
  files.push({
    path: "transcript.jsonl",
    data: events.map((e) => JSON.stringify(e)).join("\n"),
    kind: "transcript"
  });
  files.push({
    path: "state.json",
    data: JSON.stringify(state, null, 2),
    kind: "reduced-state"
  });
  files.push({
    path: "observations.jsonl",
    data: observations.map((o) => JSON.stringify(o)).join("\n"),
    kind: "observations"
  });

  if (opts.withMap !== false) {
    try {
      const map = await generateMap(opts.projectRoot);
      files.push({ path: "map.json", data: mapToJson(map), kind: "map-snapshot" });
    } catch {
      // A map failure must not block the rest of the export.
    }
  }

  const manifest: ReplayManifest = {
    version: 1,
    session: opts.sessionId,
    exportedAt: now.toISOString(),
    files: files.map((f) => {
      const buf = Buffer.from(f.data, "utf8");
      return {
        path: f.path,
        bytes: buf.length,
        sha256: sha256(buf),
        kind: f.kind
      };
    })
  };

  return {
    manifest,
    files: [
      ...files.map((f) => ({ path: f.path, data: f.data })),
      { path: "manifest.json", data: JSON.stringify(manifest, null, 2) }
    ]
  };
}

/** Write a replay bundle to disk as a zip. */
export async function exportReplay(
  outPath: string,
  opts: BuildOptions
): Promise<ReplayManifest> {
  const bundle = await buildReplayBundle(opts);
  await writeZip(outPath, bundle.files);
  return bundle.manifest;
}

/** Resolve a session id to one that exists. Falls back to the newest on disk. */
export async function resolveSessionForExport(
  projectRoot: string,
  requested: string
): Promise<string> {
  const sessions = await listSessions(projectRoot);
  if (sessions.includes(requested)) return requested;
  if (sessions[0]) return sessions[0];
  return requested;
}

/**
 * Health: keep the memory store honest as it grows. A memory that is full of
 * near-duplicates and stale facts stops being trusted, so this reports the
 * store's shape, the duplicate clusters and the stale entries, with a plain
 * verdict the dashboard and a future memory-doctor command can show.
 *
 * Pure over the loaded memories. Takes `now` so the stale window is testable.
 */

import type { Memory, MemoryType } from "./types.js";

export interface MemoryHealth {
  total: number;
  /** Count of memories that share a description with at least one other. */
  duplicates: number;
  /** Count of memories not updated within the stale window. */
  stale: number;
  byType: Record<string, number>;
  /** Plain-English verdict. */
  note: string;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function daysBetween(thenIso: string, now: number): number {
  const t = new Date(thenIso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((now - t) / 86400000);
}

export function memoryHealth(memories: Memory[], now: number, staleDays = 60): MemoryHealth {
  const byDesc = new Map<string, number>();
  const byType: Record<string, number> = {};
  let stale = 0;

  for (const m of memories) {
    byDesc.set(normalise(m.description), (byDesc.get(normalise(m.description)) ?? 0) + 1);
    byType[m.type] = (byType[m.type] ?? 0) + 1;
    const stamp = m.updated ?? m.created;
    if (stamp && daysBetween(stamp, now) > staleDays) stale += 1;
  }

  let duplicates = 0;
  for (const count of byDesc.values()) if (count > 1) duplicates += count;

  const parts: string[] = [`${memories.length} memor${memories.length === 1 ? "y" : "ies"}`];
  if (duplicates > 0) parts.push(`${duplicates} look like duplicates`);
  if (stale > 0) parts.push(`${stale} are stale (over ${staleDays} days)`);
  const note = duplicates === 0 && stale === 0
    ? `${parts[0]}, all current and distinct.`
    : `${parts.join(", ")}. Consider pruning or merging.`;

  return { total: memories.length, duplicates, stale, byType, note };
}

export function memoryTypeList(): MemoryType[] {
  return ["decision", "convention", "architecture", "gotcha", "credential-location", "todo", "fact"];
}

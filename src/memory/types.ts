/**
 * The persistent memory model. claudepilot stores durable facts as one file per
 * memory under the user's project .claude/ space, each carrying frontmatter so
 * Claude Code can match a memory to the work in front of it without reading
 * every memory file. A single MEMORY.md index lists them all, so a session can
 * load the index alone and pull only the bodies it needs.
 */

/** The kind of thing a memory records. Drives recall and pruning policy. */
export type MemoryType =
  | "decision"
  | "convention"
  | "architecture"
  | "gotcha"
  | "credential-location"
  | "todo"
  | "fact";

export const MEMORY_TYPES: readonly MemoryType[] = [
  "decision",
  "convention",
  "architecture",
  "gotcha",
  "credential-location",
  "todo",
  "fact"
];

export interface MemoryFrontmatter {
  /** Stable slug, also the file name without extension. */
  name: string;
  /** Relevance text Claude Code matches against when recalling. */
  description: string;
  type: MemoryType;
  /** Free form tags used to scope recall. */
  tags?: string[];
  /** ISO 8601 creation timestamp. */
  created?: string;
  /** ISO 8601 last update timestamp. */
  updated?: string;
}

export interface Memory extends MemoryFrontmatter {
  /** The durable fact itself, Markdown body. */
  body: string;
  /** Absolute path the memory was loaded from. */
  sourcePath: string;
}

/** A single row in the MEMORY.md index. */
export interface MemoryIndexEntry {
  name: string;
  type: MemoryType;
  description: string;
  tags: string[];
}

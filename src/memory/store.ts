import { readFile, readdir, mkdir, writeFile, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import matter from "gray-matter";
import {
  MEMORY_TYPES,
  type Memory,
  type MemoryFrontmatter,
  type MemoryIndexEntry,
  type MemoryType
} from "./types.js";

/**
 * The on disk layout. Memories live under .claude/claudepilot/memory as one
 * Markdown file per fact, with a single MEMORY.md index beside them. The index
 * is regenerated from the files, so the files are always the source of truth and
 * the index can never silently drift.
 */
export const MEMORY_SUBDIR = join(".claude", "claudepilot", "memory");
export const MEMORY_INDEX = "MEMORY.md";

export function memoryDir(projectRoot: string): string {
  return join(resolve(projectRoot), MEMORY_SUBDIR);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface AddMemoryInput {
  name?: string;
  description: string;
  type: MemoryType;
  body: string;
  tags?: string[];
}

/** Validate and normalise an incoming memory before it is written. */
export function normaliseMemory(input: AddMemoryInput): MemoryFrontmatter & {
  body: string;
} {
  if (!MEMORY_TYPES.includes(input.type)) {
    throw new Error(`unknown memory type "${input.type}"`);
  }
  if (!input.description.trim()) {
    throw new Error("a memory needs a non empty description for recall");
  }
  if (!input.body.trim()) {
    throw new Error("a memory needs a non empty body");
  }
  const name = slugify(input.name ?? input.description);
  if (!name) {
    throw new Error("could not derive a name from the description");
  }
  const now = new Date().toISOString();
  return {
    name,
    description: input.description.trim(),
    type: input.type,
    tags: input.tags ?? [],
    created: now,
    updated: now,
    body: input.body.trim()
  };
}

/** Write a single memory file, creating the store if needed. */
export async function addMemory(
  projectRoot: string,
  input: AddMemoryInput
): Promise<Memory> {
  const dir = memoryDir(projectRoot);
  await mkdir(dir, { recursive: true });
  const norm = normaliseMemory(input);
  const sourcePath = join(dir, `${norm.name}.md`);

  // If a memory with this name exists, preserve its created timestamp.
  const existing = await readFile(sourcePath, "utf8").catch(() => null);
  if (existing) {
    const prev = matter(existing).data as Partial<MemoryFrontmatter>;
    if (prev.created) norm.created = prev.created;
  }

  const { body, ...front } = norm;
  await writeFile(sourcePath, matter.stringify(`\n${body}\n`, front), "utf8");
  await regenerateIndex(projectRoot);
  return { ...front, body, sourcePath };
}

/** Update an existing memory's body, description or tags. */
export async function updateMemory(
  projectRoot: string,
  name: string,
  patch: Partial<Pick<AddMemoryInput, "description" | "body" | "tags" | "type">>
): Promise<Memory> {
  const dir = memoryDir(projectRoot);
  const sourcePath = join(dir, `${name}.md`);
  const raw = await readFile(sourcePath, "utf8").catch(() => null);
  if (raw === null) throw new Error(`no memory named "${name}"`);
  const { data, content } = matter(raw);
  const merged: AddMemoryInput = {
    name,
    description: patch.description ?? (data.description as string),
    type: (patch.type ?? data.type) as MemoryType,
    body: patch.body ?? content.trim(),
    tags: patch.tags ?? ((data.tags as string[]) ?? [])
  };
  return addMemory(projectRoot, merged);
}

/** Delete a memory file and refresh the index. */
export async function pruneMemory(
  projectRoot: string,
  name: string
): Promise<boolean> {
  const sourcePath = join(memoryDir(projectRoot), `${name}.md`);
  const exists = await stat(sourcePath).catch(() => null);
  if (!exists) return false;
  await rm(sourcePath);
  await regenerateIndex(projectRoot);
  return true;
}

/** Load every memory file. Skips the index and any non memory Markdown. */
export async function listMemories(projectRoot: string): Promise<Memory[]> {
  const dir = memoryDir(projectRoot);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const memories: Memory[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (entry.name === MEMORY_INDEX) continue;
    const sourcePath = join(dir, entry.name);
    const raw = await readFile(sourcePath, "utf8");
    const { data, content } = matter(raw);
    if (!data.name || !data.description || !data.type) continue;
    memories.push({
      name: data.name as string,
      description: data.description as string,
      type: data.type as MemoryType,
      tags: (data.tags as string[]) ?? [],
      created: data.created as string | undefined,
      updated: data.updated as string | undefined,
      body: content.trim(),
      sourcePath
    });
  }
  return memories.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Rank memories by how well their description, tags and type match a query.
 * Recall reads the index, scores it, and only then opens the bodies that win,
 * which is the whole point: relevance from frontmatter, not from reading files.
 */
export function recallMemories(
  memories: Memory[],
  query: string,
  limit = 5
): Memory[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
  if (terms.length === 0) return [];
  const scored = memories.map((m) => {
    const haystack = `${m.name} ${m.description} ${m.type} ${(m.tags ?? []).join(
      " "
    )}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (m.name.toLowerCase().includes(term)) score += 3;
      if ((m.tags ?? []).some((t) => t.toLowerCase().includes(term))) score += 2;
      if (m.description.toLowerCase().includes(term)) score += 1;
      else if (haystack.includes(term)) score += 0.5;
    }
    return { m, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.m);
}

export function indexEntries(memories: Memory[]): MemoryIndexEntry[] {
  return memories.map((m) => ({
    name: m.name,
    type: m.type,
    description: m.description,
    tags: m.tags ?? []
  }));
}

/** Render the MEMORY.md index from the loaded memories. */
export function renderIndex(memories: Memory[]): string {
  const lines: string[] = [];
  lines.push("# Project memory index");
  lines.push("");
  lines.push(
    "This file is generated by claudepilot. It lists every durable memory for " +
      "this project so a session can load the index alone and open only the " +
      "bodies it needs."
  );
  lines.push("");
  if (memories.length === 0) {
    lines.push("No memories yet.");
    lines.push("");
    return lines.join("\n");
  }
  const byType = new Map<string, Memory[]>();
  for (const m of memories) {
    const bucket = byType.get(m.type) ?? [];
    bucket.push(m);
    byType.set(m.type, bucket);
  }
  for (const type of [...byType.keys()].sort()) {
    lines.push(`## ${type}`);
    lines.push("");
    for (const m of byType.get(type) ?? []) {
      const tags = (m.tags ?? []).length ? ` (tags: ${m.tags?.join(", ")})` : "";
      lines.push(`- **${m.name}**: ${m.description}${tags}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Regenerate and persist MEMORY.md from the memory files on disk. */
export async function regenerateIndex(projectRoot: string): Promise<string> {
  const dir = memoryDir(projectRoot);
  await mkdir(dir, { recursive: true });
  const memories = await listMemories(projectRoot);
  const rendered = renderIndex(memories);
  await writeFile(join(dir, MEMORY_INDEX), rendered, "utf8");
  return rendered;
}

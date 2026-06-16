/**
 * Session digest: fold a whole session into one readable paragraph plus a few
 * headline numbers, so the dashboard can show what a session was without dumping
 * every prompt and tool call. Pure and deterministic: the same story always
 * produces the same digest, which keeps it testable and cache-friendly.
 */

import type { Story } from "./story.js";

export interface SessionDigestStats {
  prompts: number;
  tools: number;
  files: number;
  exchanges: number;
}

export interface SessionDigest {
  session: string;
  paragraph: string;
  stats: SessionDigestStats;
}

function clip(text: string, max: number): string {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

/** Distinct files across the whole session, in first-seen order. */
function sessionFiles(story: Story): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const lane of story.lanes) {
    for (const f of lane.files) {
      if (seen.has(f)) continue;
      seen.add(f);
      out.push(f);
    }
  }
  return out;
}

/**
 * Build the digest. The paragraph leads with what was first asked, weaves in up
 * to three of the agent's own lane summaries as prose, and closes with the file
 * footprint. Empty sessions degrade to a calm one-liner.
 */
export function sessionDigest(story: Story): SessionDigest {
  const prompts = story.lanes.filter((l) => !l.opening && l.prompt.trim());
  const files = sessionFiles(story);
  const summaries = story.lanes.map((l) => l.summary.trim()).filter(Boolean);

  const stats: SessionDigestStats = {
    prompts: story.promptCount,
    tools: story.toolCount,
    files: files.length,
    exchanges: story.lanes.filter((l) => !l.opening).length
  };

  if (!prompts.length && !summaries.length) {
    return { session: story.session, paragraph: "Nothing was recorded in this session yet.", stats };
  }

  const parts: string[] = [];
  if (prompts.length) {
    parts.push(`Started with: "${clip(prompts[0]!.prompt, 110)}".`);
  }
  // The lane summaries already read as their own clauses ("13 tool calls, read
  // X"), so join them as sentences rather than wrapping them in a subject.
  const body = summaries.slice(0, 3).map((s) => clip(s, 140).replace(/\.+$/, "")).join(". Then ");
  if (body) parts.push(`${body}.`);
  if (prompts.length > 1) {
    parts.push(`Across ${stats.prompts} prompts.`);
  }
  if (files.length) {
    const shown = files.slice(0, 3).map((f) => f.split("/").slice(-1)[0]).join(", ");
    parts.push(`Touched ${files.length} file${files.length === 1 ? "" : "s"} (${shown}${files.length > 3 ? ", …" : ""}).`);
  }

  return { session: story.session, paragraph: parts.join(" ").replace(/\s+/g, " ").trim(), stats };
}

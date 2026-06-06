/**
 * Session summary: distil a session into one durable memory, automatically, so
 * the store builds itself from what actually happened rather than relying on the
 * agent to remember to write it down. One summary per session, upserted in place
 * by a stable name, readable by a human on the dashboard and by Claude on the
 * next session's recall.
 *
 * Pure: it shapes the memory from the captured conversation and the session's
 * observations. The stop hook does the disk write through the memory store.
 */

import type { Conversation } from "./conversation.js";
import type { Observation } from "./observe.js";

export interface SessionSummaryInput {
  /** Stable memory name, upserted in place. */
  name: string;
  /** Always "fact": a recorded account of what happened. */
  type: "fact";
  /** Recall text, the question this summary should answer later. */
  description: string;
  body: string;
  tags: string[];
}

function shortFile(p: string): string {
  if (!p) return "";
  const parts = p.replace(/^\/+/, "").split("/");
  return parts.length <= 2 ? parts.join("/") : parts.slice(-2).join("/");
}

function topFiles(observations: Observation[], k: number): string[] {
  const counts = new Map<string, number>();
  for (const o of observations) for (const f of o.files || []) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([f]) => shortFile(f));
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function summariseSession(
  session: string,
  conversation: Conversation | null,
  observations: Observation[]
): SessionSummaryInput {
  const shortId = (session || "session").slice(0, 8);
  const exchanges = conversation?.exchanges ?? [];
  const asks = exchanges.map((e) => e.ask).filter(Boolean);
  const tools: string[] = [];
  for (const ex of exchanges) for (const t of ex.tools) if (!tools.includes(t)) tools.push(t);
  const files = topFiles(observations, 5);
  const lastAsk = asks.length ? asks[asks.length - 1]! : "";

  const lines: string[] = [];
  lines.push(`# Session ${shortId}`);
  lines.push("");
  if (asks.length) {
    lines.push("## Asked");
    for (const ask of asks.slice(0, 12)) lines.push(`- ${ask.replace(/\s+/g, " ").trim().slice(0, 200)}`);
    lines.push("");
  }
  lines.push("## Built");
  lines.push(`- ${observations.length} observation${observations.length === 1 ? "" : "s"} folded from ${exchanges.length} exchange${exchanges.length === 1 ? "" : "s"}.`);
  if (files.length) lines.push(`- Files in focus: ${joinList(files)}.`);
  if (tools.length) lines.push(`- Tools used: ${tools.slice(0, 8).join(", ")}.`);
  lines.push("");
  if (lastAsk) {
    lines.push("## Open thread");
    lines.push(lastAsk.replace(/\s+/g, " ").trim().slice(0, 240));
  }

  const focus = lastAsk ? lastAsk.replace(/\s+/g, " ").trim().slice(0, 100) : (files[0] ?? "this project");
  return {
    name: `session-summary-${shortId}`,
    type: "fact",
    description: `What happened in session ${shortId}: ${focus}`,
    body: lines.join("\n").trim(),
    tags: ["session-summary", "auto", "continuity"]
  };
}

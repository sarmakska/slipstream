/**
 * Graph: build a node-link view of the project's memory, files as nodes, the
 * sessions that touched them as nodes, and an edge wherever a session touched a
 * file. This is the bubble map at the knowledge level: navigate by relationship
 * rather than by list. Pure over the observations; the UI lays it out.
 */

import type { Observation } from "../memory/observe.js";

export interface GraphNode {
  id: string;
  label: string;
  kind: "file" | "session";
  /** How many observations reference this node; drives node size. */
  weight: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function shortFile(p: string): string {
  if (!p) return "";
  const parts = p.replace(/^\/+/, "").split("/");
  return parts.length <= 2 ? parts.join("/") : parts.slice(-2).join("/");
}

export function buildGraph(observations: Observation[], topFiles = 24): Graph {
  const fileWeight = new Map<string, number>();
  const sessionWeight = new Map<string, number>();
  const edgeWeight = new Map<string, number>();

  for (const o of observations) {
    const sid = `session:${o.session}`;
    for (const f of o.files || []) {
      if (!f) continue;
      const fid = `file:${f}`;
      fileWeight.set(fid, (fileWeight.get(fid) ?? 0) + 1);
      sessionWeight.set(sid, (sessionWeight.get(sid) ?? 0) + 1);
      const key = `${sid}|${fid}`;
      edgeWeight.set(key, (edgeWeight.get(key) ?? 0) + 1);
    }
  }

  // Keep the heaviest files so the graph stays legible.
  const keptFiles = new Set(
    [...fileWeight.entries()].sort((a, b) => b[1] - a[1]).slice(0, topFiles).map(([id]) => id)
  );

  const nodes: GraphNode[] = [];
  for (const [id, weight] of fileWeight) {
    if (!keptFiles.has(id)) continue;
    nodes.push({ id, label: shortFile(id.slice("file:".length)), kind: "file", weight });
  }
  const keptSessions = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const [key, weight] of edgeWeight) {
    const [sid, fid] = key.split("|");
    if (!keptFiles.has(fid!)) continue;
    edges.push({ from: sid!, to: fid!, weight });
    keptSessions.add(sid!);
  }
  for (const sid of keptSessions) {
    nodes.push({ id: sid, label: sid.slice("session:".length).slice(0, 8), kind: "session", weight: sessionWeight.get(sid) ?? 1 });
  }

  return { nodes, edges };
}

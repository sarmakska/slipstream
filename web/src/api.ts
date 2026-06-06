// Typed client over slipstream's existing JSON API. Every function maps to one
// /api endpoint the server already serves and tests.

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

export interface Insight { paragraph: string; bullets: string[]; }
export interface OverviewArea { area: string; files: number; symbols: number; lines: number; role: string; }
export interface Overview {
  identity: { name: string; version: string; description: string };
  narration: string;
  map: { fileCount: number; symbolCount: number; kib: number; entryPoints: string[]; areas: OverviewArea[] } | null;
  summary: Insight;
  recent: { title: string; summary: string }[];
  counts: { sessions: number; observations: number; memories: number };
  savedTokens: number;
  savedUsd: number;
}
export interface StoryLane { index: number; ts: string; prompt: string; opening: boolean; summary: string; files: string[]; actions: { tool: string; label: string; agent: string }[]; }
export interface Story { session: string; lanes: StoryLane[]; promptCount: number; toolCount: number; }
export interface Conversation { session: string; turnCount: number; exchanges: { ask: string; summary: string; tools: string[]; ts: string; replyChars: number }[]; }
export interface GraphData { nodes: { id: string; label: string; kind: "file" | "session"; weight: number }[]; edges: { from: string; to: string; weight: number }[]; }
export interface CodeNode { id: string; label: string; area: string; symbols: number; lines: number; degree: number; }
export interface CodeGraph { nodes: CodeNode[]; edges: { source: string; target: string }[]; }
export interface Resume { hasContext: boolean; openThread: string; suggestedNext: string; filesInFlight: string[]; }
export interface MemoryOverview {
  summary: Insight;
  health: { note: string } | null;
  digests: { session: string; excerpt: string; updated: string | null }[];
  durable: { name: string; description: string; updated: string | null }[];
  lessons: { title?: string; topic?: string; summary?: string; body?: string; count?: number }[];
  counts: { memories: number };
}
export interface Presence { agents: { id: string; mood: string; verb: string; status: string }[]; }
export interface Failures { failures: { ts: string; source: string; summary: string }[]; }

export const api = {
  overview: () => get<Overview>("/api/overview"),
  insights: (tab: string, session?: string) => get<Insight>(`/api/insights/${tab}${session ? `?session=${encodeURIComponent(session)}` : ""}`),
  sessions: () => get<{ sessions: string[]; info?: { session: string; lastTs: string; observations: number }[] }>("/api/sessions"),
  story: (s: string) => get<Story>(`/api/story?session=${encodeURIComponent(s)}`),
  conversation: (s: string) => get<Conversation>(`/api/conversation?session=${encodeURIComponent(s)}`),
  graph: () => get<GraphData>("/api/graph"),
  codegraph: () => get<CodeGraph>("/api/codegraph"),
  agents: () => get<{ agents: { session: string; thread: string; files: string[]; ts: string; active: boolean; ageMin: number }[] }>("/api/agents"),
  resume: (s: string) => get<Resume>(`/api/resume?session=${encodeURIComponent(s)}`),
  memory: () => get<MemoryOverview>("/api/memory/overview"),
  instincts: () => get<{ instincts: { subject: string; note: string; confidence: number }[] }>("/api/instincts"),
  presence: (s: string) => get<Presence>(`/api/presence?session=${encodeURIComponent(s)}`),
  failures: (s: string) => get<Failures>(`/api/failures?session=${encodeURIComponent(s)}`),
  projectSummary: () => get<Record<string, unknown>>("/api/project/summary"),
  day: (date: string) => get<Record<string, unknown>>(`/api/project/day?date=${date}`),
  health: () => get<{ version: string }>("/api/health"),
  sendMessage: async (s: string, text: string) => {
    await fetch(`/api/message?session=${encodeURIComponent(s)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
  }
};

/**
 * The live dashboard server. It is deliberately built on node:http alone, no
 * Express, no ws library: one fewer thing that can break the plugin build, and
 * the surface we need (static page, an SSE stream, two small JSON routes) is
 * tiny. It binds 127.0.0.1 so the dashboard is local-only, picks a free port,
 * tails the active session log, and pushes folded state to connected clients.
 *
 * Streaming uses server-sent events rather than a websocket. The traffic here is
 * one-directional (server to browser) and SSE is a few lines over plain HTTP
 * with automatic client reconnect, so a websocket would be cost without benefit.
 *
 * Idempotency lives in startDashboard, not here: the hook checks for a live
 * server before constructing one. This class only knows how to run.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { URL, fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { dirname, join as pathJoin } from "node:path";
import {
  reduceEvents,
  totalApproxTokens,
  stepTokenHistory,
  type DashboardState
} from "./state.js";
import { forecastTokens } from "../budget/forecast.js";
import { readLog, listSessions } from "./log.js";
import { renderDashboardHtml } from "./ui.js";
import {
  searchObservations,
  getObservations,
  loadObservations,
  countObservations,
  aggregateBySkill,
  distillProjectLessons,
  listMemories,
  loadConversation,
  resumeBrief,
  readInbox,
  queueMessage,
  pendingMessages,
  listConversations,
  searchConversations,
  deriveInstincts,
  type ObservationKind
} from "../memory/index.js";
import { budget, BYTES_PER_TOKEN } from "../context/budget.js";
import {
  loadBudgetConfig,
  saveBudgetConfig,
  configToFractions,
  type BudgetConfig
} from "../context/budget-config.js";
import { loadSavings, summarizeSavings } from "../context/savings.js";
import {
  liveInsights,
  projectInsights,
  journalInsights,
  sessionsInsights
} from "./insights.js";
import { storyFlow } from "./story.js";
import { extractFailures } from "./failures.js";
import { agentMood } from "./presence.js";
import { summariseMap } from "./overview.js";
import { generateMap } from "../map/index.js";

/**
 * Resolved at module load. Read from the bundled package.json so /api/health
 * can advertise the dashboard's version and a newer client can decide whether
 * to restart a stale server.
 */
export const SERVER_VERSION: string = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // src/dashboard/server.ts ships as dist/dashboard/server.js; either way the
    // package.json is two levels up.
    const raw = readFileSync(pathJoin(here, "..", "..", "package.json"), "utf8");
    return (JSON.parse(raw) as { version?: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
const SERVER_STARTED_AT = new Date().toISOString();

export interface DashboardServerOptions {
  projectRoot: string;
  /** The session to show first. Falls back to the newest on disk. */
  session?: string;
  /** Poll interval for the log tail, ms. Small so the UI feels live. */
  pollMs?: number;
  /** Port to bind; 0 lets the OS pick a free one. */
  port?: number;
}

interface Client {
  res: ServerResponse;
  session: string;
  lastSeq: number;
}

export class DashboardServer {
  private readonly opts: Required<Omit<DashboardServerOptions, "session" | "port">> & {
    session?: string;
    port: number;
  };
  private server: Server | null = null;
  private clients = new Set<Client>();
  private timer: NodeJS.Timeout | null = null;

  constructor(options: DashboardServerOptions) {
    this.opts = {
      projectRoot: options.projectRoot,
      session: options.session,
      pollMs: options.pollMs ?? 400,
      port: options.port ?? 0
    };
  }

  /** Start listening. Resolves with the bound port once the socket is up. */
  async listen(): Promise<number> {
    const server = createServer((req, res) => {
      this.handle(req, res).catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    });
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.opts.port, "127.0.0.1", () => resolve());
    });
    this.timer = setInterval(() => {
      this.pump().catch(() => {});
    }, this.opts.pollMs);
    // Do not keep the process alive only for the poll timer.
    this.timer.unref?.();
    return this.port();
  }

  port(): number {
    const addr = this.server?.address();
    return addr && typeof addr === "object" ? addr.port : 0;
  }

  url(): string {
    return `http://127.0.0.1:${this.port()}`;
  }

  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    for (const client of this.clients) client.res.end();
    this.clients.clear();
    await new Promise<void>((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
    });
    this.server = null;
  }

  /**
   * Read and JSON-parse a request body, returning {} on anything malformed. Caps
   * the body at 64 KB: the only POST is a tiny budget patch, so a larger payload
   * is a mistake or abuse, and we refuse to buffer it unbounded.
   */
  private async readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    const MAX_BODY = 64 * 1024;
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > MAX_BODY) return {};
      chunks.push(chunk as Buffer);
    }
    try {
      const raw = Buffer.concat(chunks).toString("utf8");
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  private async resolveSession(requested?: string): Promise<string> {
    if (requested) return requested;
    if (this.opts.session) return this.opts.session;
    const sessions = await listSessions(this.opts.projectRoot);
    return sessions[0] ?? "main";
  }

  private async handle(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = new URL(req.url ?? "/", this.url());
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const session = await this.resolveSession();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderDashboardHtml(session));
      return;
    }
    // /api/health: version-aware probe so a newer client can detect a stale
    // dashboard left behind by a previous build and restart it.
    if (url.pathname === "/api/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        version: SERVER_VERSION,
        pid: process.pid,
        startedAt: SERVER_STARTED_AT
      }));
      return;
    }
    if (url.pathname === "/api/sessions") {
      const sessions = await listSessions(this.opts.projectRoot);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ sessions }));
      return;
    }
    if (url.pathname === "/api/state") {
      const session = await this.resolveSession(
        url.searchParams.get("session") ?? undefined
      );
      const state = reduceEvents(await readLog(this.opts.projectRoot, session));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(state));
      return;
    }
    if (url.pathname === "/api/stream") {
      await this.stream(url, res);
      return;
    }
    if (url.pathname === "/api/search") {
      const query = url.searchParams.get("q") ?? "";
      const kindParam = url.searchParams.get("kind") ?? undefined;
      const hits = query
        ? await searchObservations(this.opts.projectRoot, {
            query,
            kind: kindParam as ObservationKind | undefined,
            session: url.searchParams.get("session") ?? undefined,
            limit: Number(url.searchParams.get("limit")) || 20
          })
        : [];
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ hits }));
      return;
    }
    // Instincts: patterns slipstream noticed recurring across sessions, the
    // self-learning signal. Hot files and recurring topics, confidence-scored.
    if (url.pathname === "/api/instincts") {
      const obs = await loadObservations(this.opts.projectRoot).catch(() => [] as Awaited<ReturnType<typeof loadObservations>>);
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 12));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ instincts: deriveInstincts(obs).slice(0, limit) }));
      return;
    }
    // Conversation search: find the exchange where a topic was discussed across
    // the full captured chat. Answers "when did we talk about X".
    if (url.pathname === "/api/search/conversation") {
      const query = url.searchParams.get("q") ?? "";
      const hits = query
        ? searchConversations(await listConversations(this.opts.projectRoot), query, Number(url.searchParams.get("limit")) || 20)
        : [];
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ hits }));
      return;
    }
    // Budget control: GET reports the config plus the served-context gauge for a
    // session; POST writes the editable target and thresholds. The gauge measures
    // context slipstream pulled in (an estimate), not the model's true tokens.
    if (url.pathname === "/api/budget") {
      if (req.method === "POST") {
        const patch = await this.readJsonBody(req);
        const saved = await saveBudgetConfig(this.opts.projectRoot, patch as Partial<BudgetConfig>);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ config: saved }));
        return;
      }
      const config = await loadBudgetConfig(this.opts.projectRoot);
      const session = await this.resolveSession(url.searchParams.get("session") ?? undefined);
      const state = reduceEvents(await readLog(this.opts.projectRoot, session));
      const estimated = totalApproxTokens(state);
      const fr = configToFractions(config);
      // The true context size (from the host transcript, written by the statusline)
      // wins when present; otherwise fall back to the bytes slipstream served.
      const hasActual = typeof config.actualTokens === "number" && config.actualTokens > 0;
      const served = hasActual ? (config.actualTokens as number) : estimated;
      const report = budget({
        bytesRead: served * BYTES_PER_TOKEN,
        approxTokens: hasActual ? (config.actualTokens as number) : undefined,
        windowTokens: fr.windowTokens,
        warnFraction: fr.warnFraction,
        compactFraction: fr.compactFraction
      });
      // Build a step-token history from the event log so the budget JSON can
      // expose a forecast of how many more steps fit before compaction. Pure;
      // shares the same compaction fraction the gauge uses.
      const history = stepTokenHistory(await readLog(this.opts.projectRoot, session));
      const forecast = forecastTokens({
        history,
        currentTokens: served,
        thresholdTokens: Math.round((fr.windowTokens ?? 0) * (fr.compactFraction ?? 0.85))
      });
      res.writeHead(200, {
        "content-type": "application/json"
      });
      res.end(
        JSON.stringify({
          config,
          served,
          estimated,
          source: hasActual ? "actual" : "estimated",
          level: report.level,
          fraction: report.usedFraction,
          forecast: {
            stepsUntilCompact: forecast.stepsUntilCompact,
            avgStepTokens: forecast.avgStepTokens,
            remainingTokens: forecast.remainingTokens
          }
        })
      );
      return;
    }
    // The optimization total: tokens slipstream's scoped reads saved versus
    // whole-file reads. Computed from slipstream's own calls, so it is exact in
    // any editor.
    if (url.pathname === "/api/savings") {
      const summary = summarizeSavings(await loadSavings(this.opts.projectRoot));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(summary));
      return;
    }
    // Insight bands. Each route runs the matching pure generator from
    // insights.js over the same queries the data panels already use, and
    // returns {paragraph, bullets}. No new persistence, no LLM: the prose is
    // a deterministic template over the observation store.
    if (url.pathname === "/api/insights/live") {
      const session = await this.resolveSession(url.searchParams.get("session") ?? undefined);
      const events = await readLog(this.opts.projectRoot, session);
      const state = reduceEvents(events);
      const savings = summarizeSavings(await loadSavings(this.opts.projectRoot));
      const config = await loadBudgetConfig(this.opts.projectRoot);
      const estimated = totalApproxTokens(state);
      const fr = configToFractions(config);
      const hasActual = typeof config.actualTokens === "number" && config.actualTokens > 0;
      const served = hasActual ? (config.actualTokens as number) : estimated;
      const report = budget({
        bytesRead: served * BYTES_PER_TOKEN,
        approxTokens: hasActual ? (config.actualTokens as number) : undefined,
        windowTokens: fr.windowTokens,
        warnFraction: fr.warnFraction,
        compactFraction: fr.compactFraction
      });
      const forecast = forecastTokens({
        history: stepTokenHistory(events),
        currentTokens: served,
        thresholdTokens: Math.round((fr.windowTokens ?? 0) * (fr.compactFraction ?? 0.85))
      });
      const insight = liveInsights({
        state,
        optPct: savings.pct,
        savedTokens: savings.savedTokens,
        scopedReads: savings.scopedReads,
        budgetPct: Math.round((report.usedFraction ?? 0) * 100),
        budgetLevel: report.level,
        stepsUntilCompact: forecast.stepsUntilCompact
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(insight));
      return;
    }
    if (url.pathname === "/api/insights/project") {
      const root = this.opts.projectRoot;
      const [obs, sessions, savings, memories] = await Promise.all([
        loadObservations(root).catch(() => [] as Awaited<ReturnType<typeof loadObservations>>),
        listSessions(root).catch(() => [] as string[]),
        loadSavings(root).then(summarizeSavings).catch(() => ({ scopedReads: 0, savedTokens: 0, pct: 0 })),
        listMemories(root).catch(() => [])
      ]);
      const insight = projectInsights({
        observations: obs,
        sessionCount: sessions.length,
        memoryCount: memories.length,
        optPct: savings.pct,
        savedTokens: savings.savedTokens,
        scopedReads: savings.scopedReads
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(insight));
      return;
    }
    if (url.pathname === "/api/insights/journal") {
      const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
      const obs = await loadObservations(this.opts.projectRoot).catch(() => []);
      const insight = journalInsights(date, obs);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(insight));
      return;
    }
    if (url.pathname === "/api/insights/sessions") {
      const root = this.opts.projectRoot;
      const [obs, sessions] = await Promise.all([
        loadObservations(root).catch(() => [] as Awaited<ReturnType<typeof loadObservations>>),
        listSessions(root).catch(() => [] as string[])
      ]);
      const insight = sessionsInsights(obs, sessions);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(insight));
      return;
    }
    // Overview: the landing answer to "what is this project, what has been
    // built, and how is it organised". Identity from package.json, a plain
    // English architecture summary from the scoped code map, the built-so-far
    // sentence from the observation store, and the most recent session story.
    if (url.pathname === "/api/overview") {
      const root = this.opts.projectRoot;
      const [mapRes, obs, sessions, savings, memories] = await Promise.all([
        generateMap(root).catch(() => null),
        loadObservations(root).catch(() => [] as Awaited<ReturnType<typeof loadObservations>>),
        listSessions(root).catch(() => [] as string[]),
        loadSavings(root).then(summarizeSavings).catch(() => ({ scopedReads: 0, savedTokens: 0, pct: 0 })),
        listMemories(root).catch(() => [])
      ]);
      let identity = { name: "this project", version: SERVER_VERSION, description: "" };
      try {
        const pkg = JSON.parse(readFileSync(pathJoin(root, "package.json"), "utf8")) as {
          name?: string; version?: string; description?: string;
        };
        identity = {
          name: pkg.name ?? identity.name,
          version: pkg.version ?? SERVER_VERSION,
          description: pkg.description ?? ""
        };
      } catch {
        // No package.json: keep the fallback identity.
      }
      const summary = projectInsights({
        observations: obs,
        sessionCount: sessions.length,
        memoryCount: memories.length,
        optPct: savings.pct,
        savedTokens: savings.savedTokens,
        scopedReads: savings.scopedReads
      });
      // Recent work prefers the real conversation (full asks) and falls back to
      // the event-derived story when no conversation has been captured yet.
      let recent: { title: string; summary: string }[] = [];
      if (sessions.length > 0) {
        const latest = sessions[0]!;
        const conv = await loadConversation(root, latest).catch(() => null);
        if (conv && conv.exchanges.length > 0) {
          recent = conv.exchanges.slice(-5).reverse().map((ex) => ({ title: ex.ask, summary: ex.summary }));
        } else {
          const story = storyFlow(await readLog(root, latest).catch(() => []));
          recent = story.lanes.slice(-5).reverse().map((l) => ({
            title: l.opening ? "Session opened" : l.prompt,
            summary: l.summary
          }));
        }
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        identity,
        map: mapRes ? summariseMap(mapRes) : null,
        summary,
        recent,
        counts: { sessions: sessions.length, observations: obs.length, memories: memories.length }
      }));
      return;
    }
    // Presence: each agent as a live character with a mood derived from its
    // latest activity, so the dashboard can animate what is happening now.
    if (url.pathname === "/api/presence") {
      const session = await this.resolveSession(url.searchParams.get("session") ?? undefined);
      const state = reduceEvents(await readLog(this.opts.projectRoot, session));
      const agents = state.agents.map((a) => {
        const last = a.activity[a.activity.length - 1];
        const { mood, verb } = agentMood(a.status, last?.label ?? "");
        return { id: a.id, status: a.status, task: a.task, mood, verb, lastLabel: last?.label ?? "" };
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ session, agents }));
      return;
    }
    // Message outbox: leave a message for the working agent from the dashboard.
    // POST queues it; the UserPromptSubmit hook delivers pending messages to the
    // agent on its next turn. GET lists the messages and their delivery state.
    if (url.pathname === "/api/message" && req.method === "POST") {
      const session = await this.resolveSession(url.searchParams.get("session") ?? undefined);
      const body = await this.readJsonBody(req);
      const text = typeof body.text === "string" ? body.text : "";
      if (!text.trim()) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "a message needs non-empty text" }));
        return;
      }
      const msg = await queueMessage(this.opts.projectRoot, session, text, new Date().toISOString());
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ queued: msg }));
      return;
    }
    if (url.pathname === "/api/messages") {
      const session = await this.resolveSession(url.searchParams.get("session") ?? undefined);
      const messages = await readInbox(this.opts.projectRoot, session);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ session, messages, pending: pendingMessages(messages).length }));
      return;
    }
    // Failures: where the agent struggled in this session, errors, denials and
    // failed commands pulled from the observations and the event log. Powers the
    // "Where Claude struggled" panel on the Live tab.
    if (url.pathname === "/api/failures") {
      const session = await this.resolveSession(url.searchParams.get("session") ?? undefined);
      const events = await readLog(this.opts.projectRoot, session);
      const all = await loadObservations(this.opts.projectRoot).catch(() => [] as Awaited<ReturnType<typeof loadObservations>>);
      const obs = all.filter((o) => o.session === session);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ session, failures: extractFailures(obs, events) }));
      return;
    }
    // Resume brief: where we left off for a session, so neither the human nor
    // Claude starts cold. Built from the captured conversation and the session's
    // observations. Powers the Resume card on the Overview.
    if (url.pathname === "/api/resume") {
      const session = await this.resolveSession(url.searchParams.get("session") ?? undefined);
      const conv = await loadConversation(this.opts.projectRoot, session);
      const all = await loadObservations(this.opts.projectRoot).catch(() => [] as Awaited<ReturnType<typeof loadObservations>>);
      const sessionObs = all.filter((o) => o.session === session);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ session, ...resumeBrief(conv, sessionObs) }));
      return;
    }
    // The full recorded conversation for one session: every human ask and the
    // assistant work that followed, folded into exchanges. Powers the
    // Conversation tab. Empty until a session has run with the hooks active.
    if (url.pathname === "/api/conversation") {
      const session = await this.resolveSession(url.searchParams.get("session") ?? undefined);
      const conv = await loadConversation(this.opts.projectRoot, session);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(conv ?? { session, exchanges: [], turnCount: 0 }));
      return;
    }
    // The said-to-did story for one session: lanes of "you said X, the agent
    // did A, B, C" folded from the event log. Powers the Flow tab.
    if (url.pathname === "/api/story") {
      const session = await this.resolveSession(url.searchParams.get("session") ?? undefined);
      const events = await readLog(this.opts.projectRoot, session);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(storyFlow(events)));
      return;
    }
    // Memory overview: the part of slipstream that survives a lost session. A
    // human-and-agent readable summary of what has been built, the per-session
    // compaction digests that survive a compact, the durable facts promoted via
    // sp_remember, and the lessons distilled across sessions. This is the memory
    // the next session reloads, rendered so a person can read it too.
    if (url.pathname === "/api/memory/overview") {
      const root = this.opts.projectRoot;
      const [obs, sessions, savings, memories, lessons] = await Promise.all([
        loadObservations(root).catch(() => [] as Awaited<ReturnType<typeof loadObservations>>),
        listSessions(root).catch(() => [] as string[]),
        loadSavings(root).then(summarizeSavings).catch(() => ({ scopedReads: 0, savedTokens: 0, pct: 0 })),
        listMemories(root).catch(() => []),
        distillProjectLessons(root, { minCount: 2, limit: 5 }).catch(() => [])
      ]);
      const summary = projectInsights({
        observations: obs,
        sessionCount: sessions.length,
        memoryCount: memories.length,
        optPct: savings.pct,
        savedTokens: savings.savedTokens,
        scopedReads: savings.scopedReads
      });
      const isDigest = (m: { name: string; tags?: string[] }): boolean =>
        (m.tags ?? []).includes("session-digest") || m.name.startsWith("session-digest-");
      const stamp = (m: { updated?: string; created?: string }): string => m.updated ?? m.created ?? "";
      const digests = memories
        .filter(isDigest)
        .map((m) => ({
          name: m.name,
          session: m.name.replace(/^session-digest-/, ""),
          updated: stamp(m) || null,
          excerpt: (m.body || "").trim().slice(0, 320)
        }))
        .sort((a, b) => (String(a.updated) < String(b.updated) ? 1 : -1))
        .slice(0, 8);
      const durable = memories
        .filter((m) => !isDigest(m))
        .map((m) => ({ name: m.name, description: m.description ?? "", updated: stamp(m) || null }))
        .sort((a, b) => (String(a.updated) < String(b.updated) ? 1 : -1))
        .slice(0, 12);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        summary,
        digests,
        durable,
        lessons,
        counts: {
          memories: memories.length,
          digests: digests.length,
          sessions: sessions.length,
          observations: obs.length
        }
      }));
      return;
    }
    if (url.pathname === "/api/stats/by-skill") {
      const obs = await loadObservations(this.opts.projectRoot);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ stats: aggregateBySkill(obs) }));
      return;
    }
    // Project-wide summary: totals across every session, for the Project tab.
    if (url.pathname === "/api/project/summary") {
      const root = this.opts.projectRoot;
      const [obs, sessions, savings, memories] = await Promise.all([
        loadObservations(root).catch(() => [] as Awaited<ReturnType<typeof loadObservations>>),
        listSessions(root).catch(() => [] as string[]),
        loadSavings(root).then(summarizeSavings).catch(() => ({ scopedReads: 0, savedTokens: 0, pct: 0 })),
        listMemories(root).catch(() => [])
      ]);
      const obsCount = obs.length || (await countObservations(root).catch(() => 0));
      const kinds: Record<string, number> = {};
      const files = new Map<string, number>();
      let lastObsTs = "";
      for (const o of obs) {
        kinds[o.kind] = (kinds[o.kind] || 0) + 1;
        for (const f of o.files || []) files.set(f, (files.get(f) || 0) + 1);
        if (o.ts > lastObsTs) lastObsTs = o.ts;
      }
      const driftCount = obs.filter((o) => (o as { drift?: unknown }).drift).length;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        version: SERVER_VERSION,
        sessions: sessions.length,
        observations: obsCount,
        memories: memories.length,
        savedTokens: savings.savedTokens,
        scopedReads: savings.scopedReads,
        optPct: savings.pct,
        uniqueFiles: files.size,
        driftCount,
        kinds,
        lastActivity: lastObsTs || null
      }));
      return;
    }
    // Daily activity heatmap (GitHub-style). Returns one bucket per day for the
    // requested window so the client can render a calendar tile per day.
    if (url.pathname === "/api/project/heatmap") {
      const days = Math.min(365, Math.max(7, Number(url.searchParams.get("days")) || 90));
      const obs = await loadObservations(this.opts.projectRoot).catch(() => []);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const buckets = new Map<string, number>();
      for (let i = 0; i < days; i += 1) {
        const d = new Date(today.getTime() - i * 86400000);
        buckets.set(d.toISOString().slice(0, 10), 0);
      }
      for (const o of obs) {
        const key = (o.ts || "").slice(0, 10);
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
      }
      const entries = [...buckets.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ days, entries: entries.map(([date, count]) => ({ date, count })) }));
      return;
    }
    // Top files touched across the project, with a session count and a last-touched
    // timestamp. Powers the file leaderboard in the Project tab.
    if (url.pathname === "/api/project/files") {
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
      const obs = await loadObservations(this.opts.projectRoot).catch(() => []);
      const agg = new Map<string, { touches: number; sessions: Set<string>; last: string }>();
      for (const o of obs) {
        for (const f of o.files || []) {
          if (!f) continue;
          const cur = agg.get(f) ?? { touches: 0, sessions: new Set<string>(), last: "" };
          cur.touches += 1;
          cur.sessions.add(o.session);
          if (o.ts > cur.last) cur.last = o.ts;
          agg.set(f, cur);
        }
      }
      const rows = [...agg.entries()]
        .map(([path, v]) => ({ path, touches: v.touches, sessions: v.sessions.size, last: v.last }))
        .sort((a, b) => b.touches - a.touches)
        .slice(0, limit);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ files: rows }));
      return;
    }
    // Per-day digest. Returns everything that happened on the requested date:
    // sessions involved, observations, files touched, tools used, drift flags,
    // and the top kinds. Powers the Daily Journal view.
    if (url.pathname === "/api/project/day") {
      const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
      const all = await loadObservations(this.opts.projectRoot).catch(() => []);
      const obs = all.filter((o) => (o.ts || "").slice(0, 10) === date);
      const sessions = new Set<string>();
      const files = new Map<string, number>();
      const kinds: Record<string, number> = {};
      const tools: Record<string, number> = {};
      const skills: Record<string, number> = {};
      let driftCount = 0;
      for (const o of obs) {
        sessions.add(o.session);
        kinds[o.kind] = (kinds[o.kind] || 0) + 1;
        for (const f of o.files || []) files.set(f, (files.get(f) || 0) + 1);
        if ((o as { drift?: unknown }).drift) driftCount += 1;
        const skill = (o as { skill?: string }).skill;
        if (skill) skills[skill] = (skills[skill] || 0) + 1;
        // Best-effort tool name from the summary's first token.
        const tok = (o.summary || "").split(/\s+/)[0];
        if (tok && /^[A-Za-z_][A-Za-z0-9_]*$/.test(tok)) tools[tok] = (tools[tok] || 0) + 1;
      }
      const topFiles = [...files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([path, count]) => ({ path, count }));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        date,
        sessions: [...sessions],
        observations: obs.length,
        driftCount,
        topFiles,
        kinds,
        tools,
        skills,
        first: obs[0]?.ts ?? null,
        last: obs[obs.length - 1]?.ts ?? null
      }));
      return;
    }
    // Delete a session's event log and observation file. Destructive; returns 204.
    if (url.pathname.startsWith("/api/sessions/") && req.method === "DELETE") {
      const session = url.pathname.slice("/api/sessions/".length);
      if (session && /^[A-Za-z0-9._-]+$/.test(session)) {
        const { unlink } = await import("node:fs/promises");
        const { join: pJoin } = await import("node:path");
        const root = this.opts.projectRoot;
        await unlink(pJoin(root, ".claude", "slipstream", "dashboard", `${session}.jsonl`)).catch(() => {});
        await unlink(pJoin(root, ".claude", "slipstream", "observations", `${session}.jsonl`)).catch(() => {});
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "invalid session id" }));
      return;
    }
    // Distilled lessons across the whole project history.
    if (url.pathname === "/api/project/lessons") {
      const minCount = Math.max(2, Number(url.searchParams.get("minCount")) || 3);
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 12));
      const lessons = await distillProjectLessons(this.opts.projectRoot, { minCount, limit }).catch(() => []);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ lessons }));
      return;
    }
    // Full detail for one observation, by id, for the viewer and for citations.
    const obsMatch = url.pathname.match(/^\/api\/observation\/(\d+)$/);
    if (obsMatch) {
      const id = Number(obsMatch[1]);
      const [obs] = await getObservations(this.opts.projectRoot, [id]);
      res.writeHead(obs ? 200 : 404, { "content-type": "application/json" });
      res.end(JSON.stringify(obs ?? { error: `no observation #${id}` }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }

  private async stream(url: URL, res: ServerResponse): Promise<void> {
    const session = await this.resolveSession(
      url.searchParams.get("session") ?? undefined
    );
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    const state = reduceEvents(await readLog(this.opts.projectRoot, session));
    this.send(res, "snapshot", state);
    const client: Client = { res, session, lastSeq: state.lastSeq };
    this.clients.add(client);
    res.on("close", () => this.clients.delete(client));
  }

  /** Tail every active session log and push fresh state to its watchers. */
  private async pump(): Promise<void> {
    if (this.clients.size === 0) return;
    const wanted = new Set([...this.clients].map((c) => c.session));
    const states = new Map<string, DashboardState>();
    for (const session of wanted) {
      states.set(
        session,
        reduceEvents(await readLog(this.opts.projectRoot, session))
      );
    }
    for (const client of this.clients) {
      const state = states.get(client.session);
      if (!state) continue;
      if (state.lastSeq > client.lastSeq) {
        client.lastSeq = state.lastSeq;
        this.send(client.res, "state", state);
      }
    }
  }

  private send(res: ServerResponse, event: string, data: unknown): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

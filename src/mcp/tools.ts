/**
 * The slipstream tool surface, exposed over MCP so Claude Code works through
 * precise calls instead of whole-file reads. Every tool here is a thin wrapper
 * over the same library the CLI uses, so there is one implementation of the map,
 * the slicing and the memory store, and the MCP server is just another caller.
 *
 * The design rule for every tool: return the smallest correct thing. sp_map
 * returns the index with no file contents, sp_symbol returns one declaration not
 * the file, sp_search returns locations not bodies. That discipline is the token
 * win the whole plugin is built around, so it lives in the tool layer where it
 * cannot be bypassed.
 */

import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  generateMap,
  mapToMarkdown,
  retrieveSymbol,
  retrieveLines,
  searchMap
} from "../map/index.js";
import { buildMindMap, mindMapToMermaid } from "../dashboard/model.js";
import { startDashboard } from "../dashboard/launch.js";
import { budget } from "../context/budget.js";
import { loadBudgetConfig, configToFractions } from "../context/budget-config.js";
import { recordSaving, loadSavings, summarizeSavings, renderSavings } from "../context/savings.js";
import {
  addMemory,
  listMemories,
  recallMemories,
  pruneMemory,
  searchObservations,
  timeline,
  getObservations,
  distillProjectLessons,
  renderHits,
  renderTimeline,
  renderObservations,
  renderLessons,
  loadObservations,
  buildDigest,
  digestToMemory,
  OBSERVATION_KINDS,
  type ObservationKind,
  type MemoryType,
  MEMORY_TYPES
} from "../memory/index.js";

/** The MCP tool descriptor as advertised by tools/list. */
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** A tool result in MCP content shape. */
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

function text(s: string): ToolResult {
  return { content: [{ type: "text", text: s }] };
}

function err(s: string): ToolResult {
  return { content: [{ type: "text", text: s }], isError: true };
}

/** Every tool the slipstream MCP server exposes, with its JSON schema. */
export const TOOL_DESCRIPTORS: ToolDescriptor[] = [
  {
    name: "sp_map",
    description:
      "Use first, instead of reading files, to orient in a project. Returns the compact project map (files, exported symbols, one-line purpose). No file contents.",
    inputSchema: {
      type: "object",
      properties: {
        root: { type: "string", description: "Project root. Defaults to the server cwd." }
      }
    }
  },
  {
    name: "sp_symbol",
    description:
      "Use to read one declaration instead of a whole file. Returns just the source slice of a single exported symbol (function, class, type, const) with its doc comment.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "File path relative to the project root." },
        symbol: { type: "string", description: "Exported symbol name." },
        root: { type: "string" }
      },
      required: ["file", "symbol"]
    }
  },
  {
    name: "sp_lines",
    description:
      "Use to read a known line window instead of a whole file. Returns exactly the lines start..end of a file.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string" },
        start: { type: "number" },
        end: { type: "number" },
        root: { type: "string" }
      },
      required: ["file", "start", "end"]
    }
  },
  {
    name: "sp_search",
    description:
      "Use to find where something lives without reading files. Ranks files by how well their path, symbols and purpose match a query. Returns locations, not contents.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        root: { type: "string" },
        limit: { type: "number" }
      },
      required: ["query"]
    }
  },
  {
    name: "sp_remember",
    description:
      "Use to persist a durable decision, convention or gotcha so it survives compaction and future sessions. Writes one memory file with frontmatter.",
    inputSchema: {
      type: "object",
      properties: {
        fact: { type: "string", description: "The durable fact to store." },
        description: { type: "string", description: "Relevance text matched on recall. Defaults to the fact." },
        type: { type: "string", enum: [...MEMORY_TYPES] },
        tags: { type: "array", items: { type: "string" } },
        root: { type: "string" }
      },
      required: ["fact"]
    }
  },
  {
    name: "sp_recall",
    description:
      "Use to pull back relevant durable facts before acting on a prior decision. Ranks the memory store by a query using frontmatter, returns only matching bodies.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
        root: { type: "string" }
      },
      required: ["query"]
    }
  },
  {
    name: "sp_forget",
    description: "Use to delete a stored memory by name and refresh the index.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        root: { type: "string" }
      },
      required: ["name"]
    }
  },
  {
    name: "sp_search_memory",
    description:
      "Use FIRST to find past work without dumping bodies into context (layer 1 of memory search): returns a compact ranked index of observations (id, time, kind, one-line summary) matched by meaning and keyword. Then narrow with sp_timeline and fetch only the ids you want with sp_observations.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to look for, in natural language." },
        kind: {
          type: "string",
          enum: [...OBSERVATION_KINDS],
          description: "Optional filter: edit, read, command, search, prompt, note."
        },
        session: { type: "string", description: "Optional: restrict to one session id." },
        since: { type: "string", description: "Optional ISO date; only observations at or after it." },
        limit: { type: "number", description: "Max rows (default 10)." },
        root: { type: "string" }
      },
      required: ["query"]
    }
  },
  {
    name: "sp_timeline",
    description:
      "Use to see what happened around an interesting result (layer 2 of memory search): returns the chronological neighbours of an observation (by id) or of the best match for a query, in time order, still as compact one-liners.",
    inputSchema: {
      type: "object",
      properties: {
        around: { type: "string", description: "An observation id (number) or a query to centre on." },
        window: { type: "number", description: "Neighbours on each side (default 3)." },
        session: { type: "string" },
        root: { type: "string" }
      },
      required: ["around"]
    }
  },
  {
    name: "sp_observations",
    description:
      "Use LAST to fetch full detail only for the ids you filtered down to (layer 3 of memory search). Always batch multiple ids in one call. This is the only call that returns full bodies, so the index and timeline keep the token cost down until here.",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "number" }, description: "Observation ids to fetch." },
        root: { type: "string" }
      },
      required: ["ids"]
    }
  },
  {
    name: "sp_budget",
    description:
      "Use to check the context budget. Returns ok/warn/compact level and an approximate token estimate for a given number of bytes pulled into context.",
    inputSchema: {
      type: "object",
      properties: {
        bytesRead: { type: "number" },
        windowTokens: { type: "number" }
      }
    }
  },
  {
    name: "sp_mindmap",
    description: "Use to see project structure as a themed Mermaid mind map for chat.",
    inputSchema: {
      type: "object",
      properties: { root: { type: "string" } }
    }
  },
  {
    name: "sp_lessons",
    description:
      "Use to see the recurring patterns slipstream has learned from this project's history: topics worked on repeatedly across sessions, distilled from the observation store. A fast answer to 'what do I keep doing here' and a source of durable facts worth promoting with sp_remember.",
    inputSchema: {
      type: "object",
      properties: {
        minCount: { type: "number", description: "Min observations for a topic to count (default 3)." },
        limit: { type: "number", description: "Max lessons (default 10)." },
        root: { type: "string" }
      }
    }
  },
  {
    name: "sp_savings",
    description:
      "Use to report how much slipstream has optimised: total tokens served by scoped reads (sp_symbol/sp_lines) versus what the whole files would have cost, and the percentage trimmed. Computed from slipstream's own tool calls, so it works in any editor.",
    inputSchema: {
      type: "object",
      properties: { root: { type: "string" } }
    }
  },
  {
    name: "sp_dashboard",
    description:
      "Use to open the live work dashboard: ensures the local dashboard server is running and returns its URL, so you can watch activity, the token-budget gauge, the optimization total and memory search in a browser tab. Works in any editor, not only Claude Code.",
    inputSchema: {
      type: "object",
      properties: { root: { type: "string" } }
    }
  },
  {
    name: "sp_digest",
    description:
      "Use to checkpoint the working context before it risks being lost — the cross-editor stand-in for the Claude Code PreCompact hook, so MCP editors (Cursor, Windsurf, Antigravity) get lossless compaction too. Distils this session's observations into a durable digest (open task, decisions, files touched, next steps) and saves it to memory so it survives a compaction or a fresh session. Call it when sp_budget reports warn/compact, or before you clear the conversation; resume later with sp_recall or sp_search_memory.",
    inputSchema: {
      type: "object",
      properties: {
        session: { type: "string", description: "Optional session id; defaults to the most recent session in the observation store." },
        openTask: { type: "string", description: "Optional one-line description of what you are working on, used as the digest's open task." },
        trigger: { type: "string", enum: ["auto", "manual"], description: "Why the digest was taken. Defaults to manual." },
        root: { type: "string" }
      }
    }
  }
];

export interface ToolContext {
  /** The default project root when a call omits one. */
  defaultRoot: string;
}

function rootOf(args: Record<string, unknown>, ctx: ToolContext): string {
  const r = args["root"];
  return typeof r === "string" && r ? r : ctx.defaultRoot;
}

/**
 * Execute a tool call by name. Pure dispatch over the library; every branch
 * returns a ToolResult and never throws, so the transport stays simple.
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (name) {
      case "sp_map": {
        const map = await generateMap(rootOf(args, ctx));
        return text(mapToMarkdown(map));
      }
      case "sp_symbol": {
        const file = String(args["file"] ?? "");
        const symbol = String(args["symbol"] ?? "");
        if (!file || !symbol) return err("sp_symbol needs file and symbol");
        const root = rootOf(args, ctx);
        const map = await generateMap(root);
        const slice = await retrieveSymbol(map, file, symbol);
        if (!slice) return err(`no symbol "${symbol}" in ${file}`);
        // Record the saving: a scoped slice instead of the whole file.
        const fullBytes = map.files.find((f) => f.path === slice.path)?.bytes ?? 0;
        recordSaving(root, {
          tool: "sp_symbol",
          file: slice.path,
          servedBytes: Buffer.byteLength(slice.code, "utf8"),
          fullBytes
        }).catch(() => {});
        return text(
          `// ${slice.path}:${slice.startLine}-${slice.endLine} (${slice.kind})\n${slice.code}`
        );
      }
      case "sp_lines": {
        const file = String(args["file"] ?? "");
        const start = Number(args["start"]);
        const end = Number(args["end"]);
        if (!file || !Number.isFinite(start) || !Number.isFinite(end)) {
          return err("sp_lines needs file, start and end");
        }
        const root = rootOf(args, ctx);
        const slice = await retrieveLines(root, file, start, end);
        if (!slice) return err(`could not read ${file}`);
        const fullBytes = await stat(join(resolve(root), file))
          .then((s) => s.size)
          .catch(() => 0);
        recordSaving(root, {
          tool: "sp_lines",
          file: slice.path,
          servedBytes: Buffer.byteLength(slice.code, "utf8"),
          fullBytes
        }).catch(() => {});
        return text(`// ${slice.path}:${slice.startLine}-${slice.endLine}\n${slice.code}`);
      }
      case "sp_search": {
        const query = String(args["query"] ?? "");
        if (!query) return err("sp_search needs a query");
        const limit = Number(args["limit"]) || 8;
        const map = await generateMap(rootOf(args, ctx));
        const hits = searchMap(map, query, limit);
        if (hits.length === 0) return text(`no matches for "${query}"`);
        const lines = hits.map(
          (h) => `${h.path} (score ${h.score}): ${h.purpose} [${h.symbols.slice(0, 8).join(", ")}]`
        );
        return text(lines.join("\n"));
      }
      case "sp_remember": {
        const fact = String(args["fact"] ?? "");
        if (!fact) return err("sp_remember needs a fact");
        const type = (args["type"] as MemoryType) ?? "decision";
        const tags = Array.isArray(args["tags"])
          ? (args["tags"] as unknown[]).map(String)
          : [];
        const m = await addMemory(rootOf(args, ctx), {
          description: String(args["description"] ?? fact),
          type: MEMORY_TYPES.includes(type) ? type : "decision",
          body: fact,
          tags
        });
        return text(`remembered "${m.name}" (${m.type})`);
      }
      case "sp_recall": {
        const query = String(args["query"] ?? "");
        if (!query) return err("sp_recall needs a query");
        const limit = Number(args["limit"]) || 5;
        const hits = recallMemories(await listMemories(rootOf(args, ctx)), query, limit);
        if (hits.length === 0) return text("no matching memories");
        return text(
          hits
            .map((m) => `## ${m.name} (${m.type})\n${m.description}\n\n${m.body}`)
            .join("\n\n")
        );
      }
      case "sp_forget": {
        const memName = String(args["name"] ?? "");
        if (!memName) return err("sp_forget needs a name");
        const ok = await pruneMemory(rootOf(args, ctx), memName);
        return text(ok ? `forgot "${memName}"` : `no memory named "${memName}"`);
      }
      case "sp_search_memory": {
        const query = String(args["query"] ?? "");
        if (!query) return err("sp_search_memory needs a query");
        const kindArg = args["kind"];
        const kind =
          typeof kindArg === "string" && OBSERVATION_KINDS.includes(kindArg as ObservationKind)
            ? (kindArg as ObservationKind)
            : undefined;
        const hits = await searchObservations(rootOf(args, ctx), {
          query,
          kind,
          session: typeof args["session"] === "string" ? (args["session"] as string) : undefined,
          since: typeof args["since"] === "string" ? (args["since"] as string) : undefined,
          limit: Number(args["limit"]) || 10
        });
        return text(renderHits(hits));
      }
      case "sp_timeline": {
        const raw = String(args["around"] ?? "");
        if (!raw) return err("sp_timeline needs an id or query in 'around'");
        const asNum = Number(raw);
        const around = raw.trim() !== "" && Number.isFinite(asNum) ? asNum : raw;
        const entries = await timeline(rootOf(args, ctx), {
          around,
          window: Number(args["window"]) || 3,
          session: typeof args["session"] === "string" ? (args["session"] as string) : undefined
        });
        return text(renderTimeline(entries));
      }
      case "sp_observations": {
        const idsRaw = args["ids"];
        const ids = Array.isArray(idsRaw)
          ? idsRaw.map((n) => Number(n)).filter((n) => Number.isFinite(n))
          : [];
        if (ids.length === 0) return err("sp_observations needs an array of numeric ids");
        const obs = await getObservations(rootOf(args, ctx), ids);
        return text(renderObservations(obs));
      }
      case "sp_budget": {
        const bytesRead = Number(args["bytesRead"]) || 0;
        // The persisted budget config is the shared source of truth: the gauge,
        // the statusline and this tool all read the same target and thresholds.
        const config = await loadBudgetConfig(rootOf(args, ctx));
        const fractions = configToFractions(config);
        const windowTokens = args["windowTokens"] ? Number(args["windowTokens"]) : fractions.windowTokens;
        const report = budget({
          bytesRead,
          windowTokens,
          warnFraction: fractions.warnFraction,
          compactFraction: fractions.compactFraction
        });
        return text(
          `level=${report.level} approxTokens=${report.approxTokens} ` +
            `target=${report.windowTokens} used=${(report.usedFraction * 100).toFixed(0)}% ` +
            `(warn ${config.warnPct}%, compact ${config.compactPct}%)\n${report.advice}`
        );
      }
      case "sp_mindmap": {
        const map = await generateMap(rootOf(args, ctx));
        return text("```mermaid\n" + mindMapToMermaid(buildMindMap(map)) + "\n```");
      }
      case "sp_lessons": {
        const lessons = await distillProjectLessons(rootOf(args, ctx), {
          minCount: Number(args["minCount"]) || 3,
          limit: Number(args["limit"]) || 10
        });
        return text(renderLessons(lessons));
      }
      case "sp_savings": {
        const summary = summarizeSavings(await loadSavings(rootOf(args, ctx)));
        return text(renderSavings(summary));
      }
      case "sp_dashboard": {
        const result = await startDashboard({ projectRoot: rootOf(args, ctx), detached: true });
        return text(
          `Live dashboard: ${result.url} ` +
            (result.started ? "(started)" : "(already running)") +
            ". Open it in a browser; it streams locally and nothing leaves the machine."
        );
      }
      case "sp_digest": {
        const root = rootOf(args, ctx);
        const requested =
          typeof args["session"] === "string" && args["session"]
            ? (args["session"] as string)
            : undefined;
        const all = await loadObservations(root, requested ? { session: requested } : {});
        if (all.length === 0) {
          return text(
            "Nothing to digest yet — no observations recorded for this project. " +
              "slipstream captures these as you use its tools (or via the plugin hooks); " +
              "once there is activity, sp_digest can checkpoint it."
          );
        }
        // Default to the most recent session when the caller did not name one.
        const session = requested ?? all[all.length - 1]!.session;
        const scoped = requested ? all : all.filter((o) => o.session === session);
        const digest = buildDigest({
          session,
          trigger: args["trigger"] === "auto" ? "auto" : "manual",
          activity: scoped.map((o) => o.summary),
          filesTouched: [...new Set(scoped.flatMap((o) => o.files))],
          openTaskHint:
            typeof args["openTask"] === "string" ? (args["openTask"] as string) : undefined
        });
        const m = await addMemory(root, digestToMemory(digest));
        return text(
          `Saved compaction digest "${m.name}" for session ${session} ` +
            `(${digest.decisions.length} decisions, ${digest.filesTouched.length} files touched). ` +
            `On resume, restore it with sp_recall "${m.name}" or sp_search_memory.`
        );
      }
      default:
        return err(`unknown tool "${name}"`);
    }
  } catch (error) {
    return err(`tool "${name}" failed: ${(error as Error).message}`);
  }
}

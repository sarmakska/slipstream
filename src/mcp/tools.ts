/**
 * The claudepilot tool surface, exposed over MCP so Claude Code works through
 * precise calls instead of whole-file reads. Every tool here is a thin wrapper
 * over the same library the CLI uses, so there is one implementation of the map,
 * the slicing and the memory store, and the MCP server is just another caller.
 *
 * The design rule for every tool: return the smallest correct thing. cp_map
 * returns the index with no file contents, cp_symbol returns one declaration not
 * the file, cp_search returns locations not bodies. That discipline is the token
 * win the whole plugin is built around, so it lives in the tool layer where it
 * cannot be bypassed.
 */

import {
  generateMap,
  mapToMarkdown,
  retrieveSymbol,
  retrieveLines,
  searchMap
} from "../map/index.js";
import { buildMindMap, mindMapToMermaid } from "../dashboard/model.js";
import { budget } from "../context/budget.js";
import {
  addMemory,
  listMemories,
  recallMemories,
  pruneMemory,
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

/** Every tool the claudepilot MCP server exposes, with its JSON schema. */
export const TOOL_DESCRIPTORS: ToolDescriptor[] = [
  {
    name: "cp_map",
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
    name: "cp_symbol",
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
    name: "cp_lines",
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
    name: "cp_search",
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
    name: "cp_remember",
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
    name: "cp_recall",
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
    name: "cp_forget",
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
    name: "cp_budget",
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
    name: "cp_mindmap",
    description: "Use to see project structure as a themed Mermaid mind map for chat.",
    inputSchema: {
      type: "object",
      properties: { root: { type: "string" } }
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
      case "cp_map": {
        const map = await generateMap(rootOf(args, ctx));
        return text(mapToMarkdown(map));
      }
      case "cp_symbol": {
        const file = String(args["file"] ?? "");
        const symbol = String(args["symbol"] ?? "");
        if (!file || !symbol) return err("cp_symbol needs file and symbol");
        const map = await generateMap(rootOf(args, ctx));
        const slice = await retrieveSymbol(map, file, symbol);
        if (!slice) return err(`no symbol "${symbol}" in ${file}`);
        return text(
          `// ${slice.path}:${slice.startLine}-${slice.endLine} (${slice.kind})\n${slice.code}`
        );
      }
      case "cp_lines": {
        const file = String(args["file"] ?? "");
        const start = Number(args["start"]);
        const end = Number(args["end"]);
        if (!file || !Number.isFinite(start) || !Number.isFinite(end)) {
          return err("cp_lines needs file, start and end");
        }
        const slice = await retrieveLines(rootOf(args, ctx), file, start, end);
        if (!slice) return err(`could not read ${file}`);
        return text(`// ${slice.path}:${slice.startLine}-${slice.endLine}\n${slice.code}`);
      }
      case "cp_search": {
        const query = String(args["query"] ?? "");
        if (!query) return err("cp_search needs a query");
        const limit = Number(args["limit"]) || 8;
        const map = await generateMap(rootOf(args, ctx));
        const hits = searchMap(map, query, limit);
        if (hits.length === 0) return text(`no matches for "${query}"`);
        const lines = hits.map(
          (h) => `${h.path} (score ${h.score}): ${h.purpose} [${h.symbols.slice(0, 8).join(", ")}]`
        );
        return text(lines.join("\n"));
      }
      case "cp_remember": {
        const fact = String(args["fact"] ?? "");
        if (!fact) return err("cp_remember needs a fact");
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
      case "cp_recall": {
        const query = String(args["query"] ?? "");
        if (!query) return err("cp_recall needs a query");
        const limit = Number(args["limit"]) || 5;
        const hits = recallMemories(await listMemories(rootOf(args, ctx)), query, limit);
        if (hits.length === 0) return text("no matching memories");
        return text(
          hits
            .map((m) => `## ${m.name} (${m.type})\n${m.description}\n\n${m.body}`)
            .join("\n\n")
        );
      }
      case "cp_forget": {
        const memName = String(args["name"] ?? "");
        if (!memName) return err("cp_forget needs a name");
        const ok = await pruneMemory(rootOf(args, ctx), memName);
        return text(ok ? `forgot "${memName}"` : `no memory named "${memName}"`);
      }
      case "cp_budget": {
        const bytesRead = Number(args["bytesRead"]) || 0;
        const windowTokens = args["windowTokens"] ? Number(args["windowTokens"]) : undefined;
        const report = budget({ bytesRead, windowTokens });
        return text(
          `level=${report.level} approxTokens=${report.approxTokens} ` +
            `window=${report.windowTokens} used=${(report.usedFraction * 100).toFixed(0)}%\n${report.advice}`
        );
      }
      case "cp_mindmap": {
        const map = await generateMap(rootOf(args, ctx));
        return text("```mermaid\n" + mindMapToMermaid(buildMindMap(map)) + "\n```");
      }
      default:
        return err(`unknown tool "${name}"`);
    }
  } catch (error) {
    return err(`tool "${name}" failed: ${(error as Error).message}`);
  }
}

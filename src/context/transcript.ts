/**
 * True context size from the host transcript. slipstream's budget has always been
 * an estimate of the bytes it served, because an MCP server cannot see the model's
 * real token count. But Claude Code writes a transcript JSONL and stamps every
 * assistant message with a `usage` block, and the statusline payload hands us its
 * path. The most recent usage is the real occupancy of the context window: the
 * tokens fed in for that turn (fresh input plus cache read plus cache creation)
 * plus what the model produced. Reading it turns the gauge from an estimate into
 * the actual number, live, with no API the server is not allowed to call.
 *
 * The parser is pure (it takes the transcript lines) so a test pins it against a
 * fixed transcript; a thin wrapper does the file read. Everything is defensive:
 * an unknown line shape, a missing field or a truncated file yields null rather
 * than throwing, because this feeds a budget hint and must never break a render.
 */

import { readFile } from "node:fs/promises";

export interface ContextUsage {
  /** Real context-window occupancy: input + cache + output of the latest turn. */
  contextTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Pull the usage block from a transcript line, wherever the host nests it. */
function usageOf(line: unknown): Record<string, unknown> | null {
  if (!line || typeof line !== "object") return null;
  const obj = line as Record<string, unknown>;
  const message = obj["message"] as Record<string, unknown> | undefined;
  const usage = (message?.["usage"] ?? obj["usage"]) as Record<string, unknown> | undefined;
  return usage && typeof usage === "object" ? usage : null;
}

/**
 * Compute true context usage from transcript lines (newest meaningful usage wins).
 * Scans from the end for the last line that carries a usage block, so it reflects
 * the current state of the window rather than an early turn. Returns null if no
 * line carries usage, which is the honest "we could not read it" signal.
 */
export function contextUsageFromTranscript(lines: string[]): ContextUsage | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const raw = lines[i]?.trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const usage = usageOf(parsed);
    if (!usage) continue;
    const inputTokens = num(usage["input_tokens"]);
    const outputTokens = num(usage["output_tokens"]);
    const cacheReadTokens = num(usage["cache_read_input_tokens"]);
    const cacheCreationTokens = num(usage["cache_creation_input_tokens"]);
    // A line that parsed as usage but is empty is not a real reading.
    if (inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens === 0) continue;
    return {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      contextTokens: inputTokens + cacheReadTokens + cacheCreationTokens + outputTokens
    };
  }
  return null;
}

/** Read a transcript file and compute its true context usage, or null on any failure. */
export async function readContextUsage(transcriptPath: string): Promise<ContextUsage | null> {
  if (!transcriptPath) return null;
  try {
    const raw = await readFile(transcriptPath, "utf8");
    return contextUsageFromTranscript(raw.split("\n"));
  } catch {
    return null;
  }
}

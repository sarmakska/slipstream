/**
 * Transcript: parse the Claude Code conversation transcript into normalised
 * turns. Claude Code writes the whole conversation as JSONL and hands every
 * hook a transcript path, so this is how slipstream recovers the full chat,
 * every human message and every assistant reply, rather than the short prompt
 * stub the user-prompt hook records.
 *
 * Pure over the JSONL string. No network, no LLM, no disk. The dashboard and
 * the conversation store both build on the turns this produces.
 */

export interface TranscriptTurn {
  role: "user" | "assistant";
  /** All text blocks joined; empty when the record carried no prose. */
  text: string;
  /** Names of tools the assistant invoked in this turn. */
  tools: string[];
  /** ISO timestamp from the record, empty when absent. */
  ts: string;
}

interface Block {
  type: string;
  text?: string;
  name?: string;
}

interface Record {
  type?: string;
  message?: { role?: string; content?: Block[] | string };
  timestamp?: string;
}

export function parseTranscript(jsonl: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let rec: Record;
    try {
      rec = JSON.parse(trimmed) as Record;
    } catch {
      continue;
    }
    const role = rec.type === "assistant" ? "assistant" : rec.type === "user" ? "user" : null;
    if (!role) continue;
    const content = rec.message?.content;
    const blocks: Block[] = Array.isArray(content)
      ? content
      : typeof content === "string"
        ? [{ type: "text", text: content }]
        : [];
    const text = blocks
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text!.trim())
      .join("\n");
    const tools = blocks
      .filter((b) => b.type === "tool_use" && b.name)
      .map((b) => b.name!);
    // A user record that is only a tool_result is not a human turn; skip it.
    if (role === "user" && !text) continue;
    turns.push({ role, text, tools, ts: rec.timestamp ?? "" });
  }
  return turns;
}

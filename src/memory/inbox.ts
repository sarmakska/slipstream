/**
 * Inbox: a local message outbox from the dashboard to the working agent. The
 * dashboard cannot drive a running Claude Code session directly, but it can
 * leave a message that the agent picks up on its next turn. The UserPromptSubmit
 * hook drains pending messages and injects them as context, so a note left on
 * the dashboard reaches the agent the next time it acts.
 *
 * Stored as JSONL per session under the gitignored store. The pure helpers are
 * tested; the read/write/drain functions do the disk IO.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface InboxMessage {
  ts: string;
  text: string;
  delivered: boolean;
}

export function parseInbox(jsonl: string): InboxMessage[] {
  const out: InboxMessage[] = [];
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const rec = JSON.parse(trimmed) as Partial<InboxMessage>;
      if (typeof rec.text === "string" && rec.text) {
        out.push({ ts: rec.ts ?? "", text: rec.text, delivered: rec.delivered === true });
      }
    } catch {
      continue;
    }
  }
  return out;
}

export function pendingMessages(messages: InboxMessage[]): InboxMessage[] {
  return messages.filter((m) => !m.delivered);
}

function inboxPath(root: string, session: string): string {
  const safe = session.replace(/[^A-Za-z0-9._-]/g, "_");
  return join(resolve(root), ".claude", "slipstream", "inbox", `${safe}.jsonl`);
}

export async function readInbox(root: string, session: string): Promise<InboxMessage[]> {
  try {
    return parseInbox(await readFile(inboxPath(root, session), "utf8"));
  } catch {
    return [];
  }
}

/** Append a message from the dashboard, ready for the agent to pick up. */
export async function queueMessage(root: string, session: string, text: string, ts: string): Promise<InboxMessage> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 2000);
  const msg: InboxMessage = { ts, text: clean, delivered: false };
  const path = inboxPath(root, session);
  await mkdir(join(path, ".."), { recursive: true });
  const existing = await readFile(path, "utf8").catch(() => "");
  await writeFile(path, `${existing}${JSON.stringify(msg)}\n`, "utf8");
  return msg;
}

/** Return the undelivered messages and mark them delivered. For the hook. */
export async function drainMessages(root: string, session: string): Promise<string[]> {
  const messages = await readInbox(root, session);
  const pending = pendingMessages(messages);
  if (pending.length === 0) return [];
  const rewritten = messages.map((m) => ({ ...m, delivered: true }));
  await writeFile(inboxPath(root, session), rewritten.map((m) => JSON.stringify(m)).join("\n") + "\n", "utf8");
  return pending.map((m) => m.text);
}

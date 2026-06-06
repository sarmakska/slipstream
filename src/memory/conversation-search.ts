/**
 * Conversation search: find the exchange where something was discussed. The
 * observation search answers "what did we do"; this answers "when did we talk
 * about X" over the full captured chat. Lexical, deterministic and pure: the
 * score is the fraction of query words present in the ask and its summary,
 * with a small bonus for an exact phrase hit.
 */

import type { Conversation } from "./conversation.js";

export interface ConversationHit {
  session: string;
  ask: string;
  summary: string;
  ts: string;
  score: number;
}

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function searchConversations(
  conversations: Conversation[],
  query: string,
  limit = 20
): ConversationHit[] {
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0) return [];
  const phrase = query.trim().toLowerCase();
  const hits: ConversationHit[] = [];

  for (const conv of conversations) {
    for (const ex of conv.exchanges) {
      const haystack = `${ex.ask} ${ex.summary}`.toLowerCase();
      let present = 0;
      for (const t of terms) if (haystack.includes(t)) present += 1;
      if (present === 0) continue;
      let score = present / terms.length;
      if (phrase.length > 2 && haystack.includes(phrase)) score += 0.5;
      hits.push({ session: conv.session, ask: ex.ask, summary: ex.summary, ts: ex.ts, score });
    }
  }

  return hits
    .sort((a, b) => b.score - a.score || (a.ts < b.ts ? 1 : -1))
    .slice(0, limit);
}

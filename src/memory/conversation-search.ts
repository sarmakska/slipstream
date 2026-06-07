/**
 * Conversation search: find the exchange where something was discussed. The
 * observation search answers "what did we do"; this answers "when did we talk
 * about X" over the full captured chat. Lexical, deterministic and pure: the
 * score is the fraction of query words present in the ask and its summary,
 * with a small bonus for an exact phrase hit.
 *
 * A term that matches a whole word ("auth" in "the auth flow") scores in full;
 * a term that only appears inside a larger word ("auth" in "author") still
 * surfaces the exchange but at a reduced weight, so an incidental substring
 * never outranks a real word hit. This keeps recall while sharpening relevance.
 */

import type { Conversation } from "./conversation.js";

export interface ConversationHit {
  session: string;
  ask: string;
  summary: string;
  ts: string;
  score: number;
}

const SUBSTRING_WEIGHT = 0.4;

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * How well a single term is present in the haystack: 1 for a whole-word hit,
 * SUBSTRING_WEIGHT for an incidental substring hit, 0 for absent. The word set
 * is precomputed by the caller so this stays cheap across many exchanges.
 */
function termPresence(term: string, words: Set<string>, haystack: string): number {
  if (words.has(term)) return 1;
  if (haystack.includes(term)) return SUBSTRING_WEIGHT;
  return 0;
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
      const words = new Set(tokenize(haystack));
      let present = 0;
      for (const t of terms) present += termPresence(t, words, haystack);
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

/**
 * A small, local, zero-dependency embedding. slipstream's whole identity is that
 * it adds nothing heavy to a user's install: no native module, no Python, no
 * vector-database process. So semantic recall here is built the same way the rest
 * of the plugin is, in plain TypeScript that the tests can drive without a
 * process.
 *
 * The model is a hashed term-frequency vector. We tokenise text into unigrams and
 * bigrams, hash each token into a fixed-width float vector, weight it by a sublinear
 * term frequency, and L2-normalise the result. Two texts that share vocabulary end
 * up pointing the same way, so cosine similarity ranks them as related even when
 * the exact words differ in inflection or order. It is not a transformer embedding
 * and it does not claim to be; it is a cheap, deterministic, offline vector that
 * makes "find the observation about the auth bug" work without exact-string luck,
 * and it is honest about being lexical-semantic rather than learned.
 *
 * Determinism matters: the same text always produces the same vector, so a vector
 * stored on disk months ago still compares correctly against a query embedded today.
 * That is why the hash is a fixed FNV-1a and nothing here touches Math.random or a
 * clock.
 */

/** Embedding width. 256 floats is enough separation for a project-sized store. */
export const EMBED_DIM = 256;

/** Tokens shorter than this carry little signal and just add noise. */
const MIN_TOKEN = 2;

/**
 * Very common English/code stop words. Dropping them sharpens cosine similarity:
 * two unrelated texts should not look similar just because both say "the" and
 * "with". Kept deliberately short; over-pruning would hurt more than it helps.
 */
const STOP = new Set([
  "the", "and", "for", "are", "was", "this", "that", "with", "from", "into",
  "but", "not", "you", "your", "have", "has", "had", "out", "use", "used",
  "using", "its", "it's", "their", "then", "than", "they", "them", "can",
  "will", "would", "should", "could", "been", "being", "all", "any", "our"
]);

/** FNV-1a, a fast deterministic non-cryptographic hash. Stable across runs. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply, kept in range with Math.imul.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Split text into lowercased word tokens. Code identifiers are split on case and
 * separators too (retrieveSymbol -> retrieve, symbol) so a camelCase name in the
 * code matches a spaced query in the prompt.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  // Break camelCase / snake_case / kebab into parts, then split on non-alnum.
  const spaced = text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ");
  for (const raw of spaced.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < MIN_TOKEN) continue;
    if (STOP.has(raw)) continue;
    out.push(raw);
  }
  return out;
}

/**
 * Build the bag of terms used for the vector: every unigram, plus adjacent
 * bigrams. Bigrams give a little word-order sensitivity so "row level security"
 * and "security level row" are not treated as identical.
 */
function terms(tokens: string[]): string[] {
  const out = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

/**
 * Embed text into a unit-length vector. Sublinear (1 + log count) term weighting
 * stops a word repeated twenty times from dominating, which matters because tool
 * activity is repetitive ("read read read"). An empty or all-stopword input
 * returns a zero vector, which cosine treats as similar to nothing.
 */
export function embed(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  const counts = new Map<string, number>();
  for (const term of terms(tokenize(text))) {
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  for (const [term, count] of counts) {
    const weight = 1 + Math.log(count);
    const h = fnv1a(term);
    const bucket = h % EMBED_DIM;
    // A sign bit drawn from a second hash bit lets distinct terms cancel rather
    // than only ever adding, which spreads them more evenly across the space.
    const sign = (h & 0x80000000) !== 0 ? -1 : 1;
    vec[bucket] = (vec[bucket] ?? 0) + sign * weight;
  }
  return normalize(vec);
}

/** L2-normalise in place-style (returns the same array) so cosine is a dot product. */
export function normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const mag = Math.sqrt(sum);
  if (mag === 0) return vec;
  for (let i = 0; i < vec.length; i++) vec[i] = (vec[i] ?? 0) / mag;
  return vec;
}

/**
 * Cosine similarity of two unit vectors is their dot product, in [-1, 1] (in
 * practice [0, 1] here since term weights are non-negative before signing). Guards
 * a length mismatch by comparing only the overlap, so a vector written by an older
 * EMBED_DIM never throws, it just compares conservatively.
 */
export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
}

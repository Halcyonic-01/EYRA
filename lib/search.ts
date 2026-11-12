import type { Product } from "../components/products/types";
import { COLLECTIONS, filterByCollection } from "../config/collections";

/**
 * Product search for the storefront. Runs in the browser over the catalogue the
 * page already has (getProducts), so it needs no server round trip per key.
 *
 * Ranking, best first:
 *   1. the product name is the query, or starts with it
 *   2. every word of the query matches the product
 *   3. how well each word matches: whole word, then start of a word, then a
 *      synonym ("necklace" for a chain), then inside a word; in the name first,
 *      then type, tags, collections, categories, description
 * A word that matches nothing anywhere is corrected to the closest catalogue
 * word ("rnig" → "ring"); a word that already matches is never "corrected", so
 * "ring" can't pull in "king". When nothing matches at all, the closest
 * products by spelling are returned instead of an empty list.
 */

export type SearchMode =
  /** Every word matched as typed. */
  | "exact"
  /** Every word matched after fixing a typo; `correctedQuery` says how. */
  | "corrected"
  /** No product matches every word; these match some of them. */
  | "partial"
  /** Nothing matched; these are the closest products by spelling. */
  | "closest";

export interface SearchResult {
  products: Product[];
  mode: SearchMode;
  /** The query as it was understood, when a word was corrected. */
  correctedQuery?: string;
  /** Words that matched nothing, even after correction. */
  unmatched: string[];
}

/* ── Words ─────────────────────────────────────────────────── */

/** Words that say nothing about which product is wanted. */
const STOPWORDS = new Set([
  "a", "an", "and", "any", "buy", "by", "for", "from", "i", "in", "is", "it", "looking", "me",
  "my", "need", "of", "on", "or", "please", "show", "some", "the", "to", "want", "with",
  "jewellery", "jewelry", "jewel", "piece",
]);

/**
 * Different ways customers say the same thing, including common Hindi words.
 * Every word in a group finds the others. Keep words in their singular form.
 */
const SYNONYM_GROUPS: string[][] = [
  ["ring", "band", "anguthi", "angoothi"],
  ["chain", "necklace", "neckchain", "haar"],
  ["pendant", "locket", "charm"],
  ["anklet", "payal", "paayal", "pajeb", "ankle"],
  ["bracelet", "kada", "kara", "bangle", "cuff", "wristlet"],
  ["silver", "sterling", "925", "chandi", "chaandi"],
  ["men", "man", "him", "his", "male", "boy", "gent", "guy", "husband", "boyfriend", "dad", "father", "brother"],
  ["women", "woman", "her", "female", "girl", "lady", "wife", "girlfriend", "mom", "mother", "sister"],
  ["couple", "matching", "partner"],
  ["gift", "present"],
  ["stacking", "stackable", "stack"],
  ["moon", "luna", "lunar"],
  ["star", "celestial", "cosmic"],
  ["minimal", "simple", "plain", "dainty", "delicate"],
  ["bold", "chunky", "statement", "heavy"],
  ["signet", "seal"],
];

const SYNONYMS = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    const key = stem(word);
    const others = group.map(stem).filter((w) => w !== key);
    SYNONYMS.set(key, [...new Set([...(SYNONYMS.get(key) ?? []), ...others])]);
  }
}

/** Singular, lower-case form, so "Rings", "rings" and "ring" are one word. */
export function stem(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

/** Lower-case, accents removed, punctuation as spaces. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function words(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ").map(stem) : [];
}

/* ── Index ─────────────────────────────────────────────────── */

const FIELD_WEIGHTS = {
  name: 10,
  type: 7,
  tags: 5,
  collections: 5,
  categories: 4,
  description: 2,
} as const;

type Field = keyof typeof FIELD_WEIGHTS;
const FIELDS = Object.keys(FIELD_WEIGHTS) as Field[];

interface Entry {
  product: Product;
  order: number;
  name: string;
  fields: Record<Field, string[]>;
  trigrams: Set<string>;
}

export interface SearchIndex {
  entries: Entry[];
  /** Every word in the catalogue (and the synonym lists), for typo correction. */
  vocabulary: Map<string, number>;
}

/** Storefront collections a product belongs to ("Rings", "For Her"), plus any set in Medusa. */
function collectionLabels(product: Product): string[] {
  const own = COLLECTIONS.filter((c) => filterByCollection([product], c).length > 0).map((c) => c.label);
  return [...own, ...(product.collections ?? [])];
}

/** Build once per catalogue; searching then only reads it. */
export function buildSearchIndex(products: Product[]): SearchIndex {
  const vocabulary = new Map<string, number>();
  const entries = products.map((product, order) => {
    const fields: Record<Field, string[]> = {
      name: words(product.name),
      type: words(`${product.type} ${product.typeLabel ?? ""}`),
      tags: words((product.tags ?? []).join(" ")),
      collections: words(collectionLabels(product).join(" ")),
      categories: words((product.categories ?? []).join(" ")),
      description: words(product.description ?? ""),
    };
    for (const field of FIELDS) {
      for (const w of fields[field]) vocabulary.set(w, (vocabulary.get(w) ?? 0) + 1);
    }
    const name = normalize(product.name);
    const trigrams = trigramsOf(`${name} ${fields.type.join(" ")} ${fields.collections.join(" ")} ${fields.tags.join(" ")}`);
    return { product, order, name, fields, trigrams };
  });
  for (const word of SYNONYMS.keys()) {
    if (!vocabulary.has(word)) vocabulary.set(word, 0);
  }
  return { entries, vocabulary };
}

/* ── Matching ──────────────────────────────────────────────── */

/** How well one query word matches one product word, 0 to 1. */
function wordMatch(query: string, word: string): number {
  if (query === word) return 1;
  if (query.length >= 2 && word.startsWith(query)) return 0.75 + 0.2 * (query.length / word.length);
  if (query.length >= 4 && word.includes(query)) return 0.45;
  return 0;
}

/** Best weighted match of one query word in a product, synonyms counted a little lower. */
function wordScore(query: string, entry: Entry, quality: number): number {
  const candidates: [string, number][] = [[query, 1], ...(SYNONYMS.get(query) ?? []).map((s): [string, number] => [s, 0.7])];
  let best = 0;
  for (const field of FIELDS) {
    for (const word of entry.fields[field]) {
      for (const [candidate, factor] of candidates) {
        const m = wordMatch(candidate, word);
        if (m > 0) best = Math.max(best, FIELD_WEIGHTS[field] * m * factor * quality);
      }
    }
  }
  return best;
}

/** Edits to turn a into b, a swap of two neighbours counting as one. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * The catalogue word a mistyped word most likely meant, or null. Short words
 * get one edit and must keep their first letter ("gold" is not "bold"); longer
 * ones get two. A half-typed word is compared with the start of longer words.
 */
function correct(query: string, vocabulary: Map<string, number>): string | null {
  if (query.length < 4 || /^\d+$/.test(query)) return null;
  const allowed = query.length >= 8 ? 2 : 1;
  let best: { word: string; distance: number; count: number } | null = null;
  for (const [word, count] of vocabulary) {
    if (query.length <= 5 && word[0] !== query[0]) continue;
    if (Math.abs(word.length - query.length) > allowed && word.length < query.length) continue;
    const whole = editDistance(query, word);
    const prefix = word.length > query.length ? editDistance(query, word.slice(0, query.length)) + 0.5 : Infinity;
    const distance = Math.min(whole, prefix);
    if (distance > allowed) continue;
    if (!best || distance < best.distance || (distance === best.distance && count > best.count)) {
      best = { word, distance, count };
    }
  }
  return best?.word ?? null;
}

/* ── Closest products ──────────────────────────────────────── */

function trigramsOf(text: string): Set<string> {
  const grams = new Set<string>();
  for (const w of normalize(text).split(" ")) {
    const padded = `  ${w} `;
    for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

/** Products most alike in spelling, or the catalogue's first ones when none are alike. */
function closest(index: SearchIndex, query: string, limit: number): Product[] {
  const grams = trigramsOf(query);
  const scored = index.entries
    .map((entry) => {
      let shared = 0;
      for (const g of grams) if (entry.trigrams.has(g)) shared++;
      return { entry, score: (2 * shared) / (grams.size + entry.trigrams.size || 1) };
    })
    .sort((a, b) => b.score - a.score || a.entry.order - b.entry.order);
  const alike = scored.filter((s) => s.score >= 0.12).slice(0, limit);
  return (alike.length ? alike : scored.slice(0, limit)).map((s) => s.entry.product);
}

/* ── Search ────────────────────────────────────────────────── */

const CLOSEST_LIMIT = 8;

export function searchProducts(index: SearchIndex, rawQuery: string): SearchResult {
  const queryWords = words(rawQuery);
  const meaningful = queryWords.filter((w) => !STOPWORDS.has(w));
  const terms = meaningful.length ? meaningful : queryWords;
  if (!terms.length) {
    return { products: index.entries.map((e) => e.product), mode: "exact", unmatched: [] };
  }

  // Each word as typed, or corrected when it matches nothing anywhere.
  const understood: { term: string; quality: number; original: string }[] = [];
  const unmatched: string[] = [];
  let corrected = false;
  for (const term of terms) {
    if (index.entries.some((e) => wordScore(term, e, 1) > 0)) {
      understood.push({ term, quality: 1, original: term });
      continue;
    }
    const fixed = correct(term, index.vocabulary);
    if (fixed && index.entries.some((e) => wordScore(fixed, e, 1) > 0)) {
      understood.push({ term: fixed, quality: 0.85, original: term });
      corrected = true;
    } else {
      unmatched.push(term);
    }
  }

  if (!understood.length) {
    return { products: closest(index, rawQuery, CLOSEST_LIMIT), mode: "closest", unmatched };
  }

  const phrase = normalize(rawQuery);
  const ranked = index.entries
    .map((entry) => {
      let score = 0;
      let matched = 0;
      for (const { term, quality } of understood) {
        const s = wordScore(term, entry, quality);
        if (s > 0) {
          score += s;
          matched++;
        }
      }
      if (matched && entry.name === phrase) score += 100;
      else if (matched && phrase.length >= 3 && entry.name.startsWith(phrase)) score += 30;
      else if (matched && phrase.includes(" ") && entry.name.includes(phrase)) score += 20;
      return { entry, score, matched };
    })
    .filter((r) => r.matched > 0);

  const best = Math.max(...ranked.map((r) => r.matched));
  const everyWord = best === understood.length && unmatched.length === 0;
  // When some products match every word, only those are shown.
  const shown = everyWord ? ranked.filter((r) => r.matched === best) : ranked;
  shown.sort((a, b) => b.matched - a.matched || b.score - a.score || a.entry.order - b.entry.order);

  const correctedQuery = corrected
    ? queryWords.map((w) => understood.find((u) => u.original === w)?.term ?? w).join(" ")
    : undefined;

  return {
    products: shown.map((r) => r.entry.product),
    mode: !everyWord ? "partial" : corrected ? "corrected" : "exact",
    correctedQuery,
    unmatched,
  };
}

import type { Product } from "@/components/products/types";

type Gender = "men" | "women";

function gendersOf(p: Pick<Product, "audiences">): Set<Gender> {
  const found = new Set<Gender>();
  for (const audience of p.audiences ?? []) {
    if (audience === "men" || audience === "women") found.add(audience);
  }
  return found;
}

/**
 * How a candidate relates to the product being viewed, by who it is for.
 * - match: made for the same gender
 * - neutral: couple or no audience set, so it suits anyone
 * - opposite: made only for the other gender
 * A viewed product with no single gender (couple, unset, or both) has no
 * opposite: everything counts as neutral and only the type decides.
 */
function fit(current: Set<Gender>, candidate: Set<Gender>): "match" | "neutral" | "opposite" {
  if (current.size !== 1 || candidate.size === 0) return "neutral";
  return [...candidate].some((g) => current.has(g)) ? "match" : "opposite";
}

/**
 * Orders the shop by how well each piece goes with the one being viewed:
 *   1. same type, same gender      4. other type, suits anyone
 *   2. same type, suits anyone     5. same type, other gender
 *   3. other type, same gender     6. other type, other gender
 * Pieces for the other gender only ever come after everything that suits the
 * viewer, so a men's ring never leads with a women's one, or the reverse.
 * Within a step the nearest price comes first; equal prices keep shop order.
 */
export function rankSimilar(current: Product, all: Product[], limit = 8): Product[] {
  const mine = gendersOf(current);
  const ranked = all
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => p.id !== current.id)
    .map(({ p, index }) => {
      const sameType = p.type === current.type;
      const f = fit(mine, gendersOf(p));
      const step =
        f === "opposite" ? (sameType ? 4 : 5) : f === "match" ? (sameType ? 0 : 2) : sameType ? 1 : 3;
      return { p, index, step, gap: Math.abs(p.price - current.price) };
    });

  ranked.sort((a, b) => a.step - b.step || a.gap - b.gap || a.index - b.index);
  return ranked.slice(0, limit).map(({ p }) => p);
}

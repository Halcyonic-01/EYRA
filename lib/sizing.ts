/**
 * Indian ring size chart, shared by the product detail size guide and the
 * public sizing chart on /authenticity-and-care so the two cannot diverge.
 *
 * Circumference and diameter are the inner measurements of the band, in mm.
 * Values are the Indian standard as published by Tanishq ("Tanishq Ring Size
 * Chart") and Muthoot Aurum (Indivara "Size Chart 1 and 2"), which agree for
 * every size here; sizechart.com/ring/india lists the same figures. Sizes are
 * not evenly spaced in that standard, so do not extrapolate new ones.
 */
export interface RingSize {
  size: number;
  circumference: number;
  diameter: number;
}

export const SIZE_CHART: readonly RingSize[] = [
  { size: 6,  circumference: 46.1, diameter: 14.7 },
  { size: 7,  circumference: 47.4, diameter: 15.1 },
  { size: 8,  circumference: 48.0, diameter: 15.3 },
  { size: 9,  circumference: 48.7, diameter: 15.5 },
  { size: 10, circumference: 50.0, diameter: 15.9 },
  { size: 11, circumference: 51.2, diameter: 16.3 },
  { size: 12, circumference: 51.9, diameter: 16.5 },
  { size: 13, circumference: 53.1, diameter: 16.9 },
  { size: 14, circumference: 54.4, diameter: 17.3 },
  { size: 15, circumference: 55.1, diameter: 17.5 },
  { size: 16, circumference: 56.3, diameter: 17.9 },
  { size: 17, circumference: 57.0, diameter: 18.1 },
  { size: 18, circumference: 58.3, diameter: 18.5 },
  { size: 19, circumference: 58.9, diameter: 18.8 },
  { size: 20, circumference: 60.2, diameter: 19.2 },
  { size: 21, circumference: 60.8, diameter: 19.4 },
  { size: 22, circumference: 62.1, diameter: 19.8 },
  { size: 23, circumference: 62.7, diameter: 20.0 },
  { size: 24, circumference: 64.0, diameter: 20.4 },
];

/**
 * The ring sizes on sale for now, by who the ring is for. This only limits what the product
 * page offers: nothing is added to, removed from or changed in Medusa, so the other sizes
 * come back by editing this list. The size chart above stays 6 to 24 and is separate.
 */
export const RING_SIZES_BY_AUDIENCE: Readonly<Record<"women" | "men", readonly string[]>> = {
  women: ["10", "12", "14"],
  men: ["18", "20", "22"],
};

/**
 * `sizes` cut down to the sizes on sale for a ring made for women, or for men. Anything else is
 * left exactly as it is: other product types, rings for couples or with no audience set, and
 * rings for both. A ring that would be left with no size at all keeps its own, so it is never
 * unbuyable because of this list.
 */
export function limitRingSizes(
  sizes: readonly string[],
  type: string,
  audiences: readonly string[] | undefined
): string[] {
  const kinds = (["women", "men"] as const).filter((kind) => audiences?.includes(kind));
  if (type !== "ring" || kinds.length !== 1) return [...sizes];
  const allowed = RING_SIZES_BY_AUDIENCE[kinds[0]];
  const kept = sizes.filter((size) => allowed.includes(size));
  return kept.length > 0 ? kept : [...sizes];
}

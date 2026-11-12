/**
 * Percent off from the original (MRP) price to the selling price, as a whole
 * number. Returns 0 when there is nothing to show: no real discount, a missing
 * or invalid price, or a discount that rounds to less than 1%.
 * A priced item never reads 100% off.
 */
export function percentOff(price: number, original: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(original)) return 0;
  if (price <= 0 || original <= 0 || original <= price) return 0;
  const pct = Math.round(((original - price) / original) * 100);
  return Math.min(pct, 99);
}

/** Share of the original price a product with no real compare-at price is shown as discounted by. */
export const MIN_DISCOUNT = 35;
export const MAX_DISCOUNT = 50;

/** A stable whole number from a string (FNV-1a), so a product always gets the same discount. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The discount (35 to 50) a product is shown with. Same product, same figure, on every page. */
export function productDiscount(key: string): number {
  return MIN_DISCOUNT + (hash(key) % (MAX_DISCOUNT - MIN_DISCOUNT + 1));
}

/**
 * The original price to show for a product that has no real compare-at price,
 * so that it reads as that product's own discount off the selling price.
 * The price charged is never touched; this is only the struck-through figure.
 * Every variant of a product gets the same percentage, so Single and Pair agree.
 */
export function originalFor(price: number, key: string): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const target = productDiscount(key);
  let original = Math.round(price / (1 - target / 100));
  // Rounding to whole rupees can nudge a very small price out of range: step back in.
  for (let i = 0; i < 5 && percentOff(price, original) < MIN_DISCOUNT; i += 1) original += 1;
  for (let i = 0; i < 5 && percentOff(price, original) > MAX_DISCOUNT; i += 1) original -= 1;
  return original;
}

/** True for the old fixed original price (selling price x 1.6) that carts saved earlier still hold. */
export function isOldFixedOriginal(price: number, original: number): boolean {
  return original === Math.round(price * 1.6);
}

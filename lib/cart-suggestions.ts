import type { Product } from "@/components/products/types";

const SHOWN = 2;

/**
 * Pieces to suggest beside the bag: in stock, not already in it, and of a type
 * the bag does not have yet (a chain beside a ring), then the nearest in price.
 */
export function pickSuggestions(products: Product[], inBag: string[], shown = SHOWN): Product[] {
  const bag = new Set(inBag);
  const bagProducts = products.filter((p) => bag.has(p.id));
  const bagTypes = new Set(bagProducts.map((p) => p.type));
  const average = bagProducts.length
    ? bagProducts.reduce((sum, p) => sum + p.price, 0) / bagProducts.length
    : 0;
  return products
    .filter((p) => !bag.has(p.id) && p.inStock > 0 && p.price > 0)
    .sort((a, b) => {
      const newType = Number(bagTypes.has(a.type)) - Number(bagTypes.has(b.type));
      if (newType !== 0) return newType;
      return Math.abs(a.price - average) - Math.abs(b.price - average);
    })
    .slice(0, shown);
}

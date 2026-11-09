import type { ProductChoice, ProductVariant } from "@/components/products/types";

/**
 * Picking a variant on the product page. Pure, so it can be tested without a
 * browser. Medusa's variant list and prices are the only source of truth: this
 * never works out a price, it only finds the variant that matches the choices.
 */

/** Option title → chosen value. */
export type Selection = Record<string, string>;

function matches(variant: ProductVariant, wanted: Selection): boolean {
  return Object.entries(wanted).every(([title, value]) => variant.options[title] === value);
}

/** Variants that agree with every choice made so far. */
export function candidateVariants(variants: readonly ProductVariant[], wanted: Selection): ProductVariant[] {
  return variants.filter((variant) => matches(variant, wanted));
}

/**
 * What to preselect: for every choice, the value of the cheapest variant, so
 * the page opens on the lowest price (a single anklet, a pendant without a chain).
 */
export function defaultSelection(
  variants: readonly ProductVariant[],
  choices: readonly ProductChoice[]
): Selection {
  const cheapest = [...variants].sort((a, b) => a.price - b.price)[0];
  const selection: Selection = {};
  for (const choice of choices) {
    const fromCheapest = cheapest?.options[choice.title];
    selection[choice.title] = fromCheapest && choice.values.includes(fromCheapest) ? fromCheapest : choice.values[0];
  }
  return selection;
}

/**
 * A size option's values in the order to show them. Medusa keeps them as text,
 * so "7", "7.5", "S" and "Small" are all valid sizes. When every value is a
 * number they are shown smallest first (6, 7 ... 20, not 10, 11 ... 6);
 * otherwise in the order they were entered in the admin.
 */
export function orderSizes(values: readonly string[]): string[] {
  const cleaned = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  const numeric = cleaned.every((value) => /^\d+(\.\d+)?$/.test(value));
  return numeric ? cleaned.sort((a, b) => Number(a) - Number(b)) : cleaned;
}

export interface Resolved {
  /** The one variant to sell, or null while a size is still to be picked. */
  variant: ProductVariant | null;
  /** The price to show: the variant's, or the lowest of those still possible. */
  price: number;
  originalPrice: number;
  needsSize: boolean;
}

/**
 * The variant the customer has chosen. `sizeTitle` is the size option's title
 * (a ring's size, or any other product's); when the product has one and no size
 * is picked, there is no single variant yet, but the price can still be shown.
 */
export function resolveVariant(
  variants: readonly ProductVariant[],
  choices: Selection,
  sizeTitle: string | undefined,
  size: string | null
): Resolved {
  const wanted: Selection = { ...choices };
  if (sizeTitle && size !== null) wanted[sizeTitle] = size;

  const candidates = candidateVariants(variants, wanted);
  const needsSize = Boolean(sizeTitle) && size === null;

  const pool = candidates.length > 0 ? candidates : [...variants];
  const cheapest = [...pool].sort((a, b) => a.price - b.price)[0];

  const variant = needsSize ? null : candidates.length === 1 ? candidates[0] : candidates[0] ?? null;
  return {
    variant,
    price: variant?.price ?? cheapest?.price ?? 0,
    originalPrice: variant?.originalPrice ?? cheapest?.originalPrice ?? 0,
    needsSize,
  };
}

export interface ChoiceOption {
  value: string;
  /** Price of this value, given the other choices. */
  price: number;
  inStock: boolean;
}

/** What each value of one choice would cost and whether it can be bought, given the other choices. */
export function choiceOptions(
  variants: readonly ProductVariant[],
  choice: ProductChoice,
  current: Selection,
  sizeTitle: string | undefined,
  size: string | null
): ChoiceOption[] {
  return choice.values.map((value) => {
    const wanted: Selection = { ...current, [choice.title]: value };
    if (sizeTitle && size !== null) wanted[sizeTitle] = size;
    const candidates = candidateVariants(variants, wanted);
    const prices = candidates.map((variant) => variant.price);
    return {
      value,
      price: prices.length ? Math.min(...prices) : 0,
      inStock: candidates.some((variant) => variant.inStock > 0),
    };
  });
}

/**
 * Each size with its price and whether it can be bought, given the other
 * choices made (a ring that also comes as a pair is sold out in one and not the
 * other). A size with no variant left in stock is shown but cannot be picked.
 */
export function sizeOptions(
  variants: readonly ProductVariant[],
  sizes: readonly string[],
  current: Selection,
  sizeTitle: string | undefined
): ChoiceOption[] {
  // Without a variant list (development mock data) there is no stock to judge by.
  if (!sizeTitle || variants.length === 0) return sizes.map((value) => ({ value, price: 0, inStock: true }));
  return choiceOptions(variants, { title: sizeTitle, values: [...sizes] }, current, undefined, null);
}

/** The same size, whether saved as text ("7") or, on an older cart line, as a number (7). */
export function sameSize(a: string | number | null | undefined, b: string | number | null | undefined): boolean {
  return String(a ?? "") === String(b ?? "");
}

/** A cart line for this variant already exists. */
export function isInCart(items: readonly { variantId?: string }[], variantId: string | undefined): boolean {
  return !!variantId && items.some((item) => item.variantId === variantId);
}

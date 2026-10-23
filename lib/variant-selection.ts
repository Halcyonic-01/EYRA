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

export interface Resolved {
  /** The one variant to sell, or null while a ring size is still to be picked. */
  variant: ProductVariant | null;
  /** The price to show: the variant's, or the lowest of those still possible. */
  price: number;
  originalPrice: number;
  needsSize: boolean;
}

/**
 * The variant the customer has chosen. `sizeTitle` is the ring size option's
 * title; when the product has one and no size is picked, there is no single
 * variant yet, but the price can still be shown.
 */
export function resolveVariant(
  variants: readonly ProductVariant[],
  choices: Selection,
  sizeTitle: string | undefined,
  size: number | null
): Resolved {
  const wanted: Selection = { ...choices };
  if (sizeTitle && size !== null) wanted[sizeTitle] = String(size);

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
  size: number | null
): ChoiceOption[] {
  return choice.values.map((value) => {
    const wanted: Selection = { ...current, [choice.title]: value };
    if (sizeTitle && size !== null) wanted[sizeTitle] = String(size);
    const candidates = candidateVariants(variants, wanted);
    const prices = candidates.map((variant) => variant.price);
    return {
      value,
      price: prices.length ? Math.min(...prices) : 0,
      inStock: candidates.some((variant) => variant.inStock > 0),
    };
  });
}

/** A cart line for this variant already exists. */
export function isInCart(items: readonly { variantId?: string }[], variantId: string | undefined): boolean {
  return !!variantId && items.some((item) => item.variantId === variantId);
}

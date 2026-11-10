/** Who a product is made for. Set by the product's category in Medusa. */
export type Audience = "men" | "women" | "couple";

/**
 * A size the customer chose, exactly as written in Medusa ("7", "7.5", "S").
 * A number is an older cart or wishlist line saved before sizes were text.
 */
export type ChosenSize = string | number | null;

/** One purchasable variant of a product, priced by Medusa. */
export interface ProductVariant {
  id: string;
  title: string;
  price: number;
  originalPrice: number;
  inStock: number;
  /** Option title → chosen value, for example { Size: "12" } or { Pack: "Pair" }. */
  options: Record<string, string>;
}

/** A choice the customer makes on the product page, besides ring size. */
export interface ProductChoice {
  title: string;
  values: string[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  description: string;
  images: string[];
  inStock: number;
  type: "ring" | "pendant" | "bracelet" | "anklet";
  /** Who the product is for, from its Medusa categories. Empty when none are set. */
  audiences?: Audience[];
  /** Medusa variant ID for the cheapest/default variant. Undefined for mock data. */
  variantId?: string;
  /** True when variants differ in price, so listings show "From ₹x". */
  hasPriceRange?: boolean;
  /** True when the customer must choose (size, pack, chain) before adding to the cart. */
  needsChoice?: boolean;
  /** Every variant. Only filled on the product page, where the choice is made. */
  variants?: ProductVariant[];
}

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
  type: "ring" | "chain" | "bracelet" | "anklet";
  /** Medusa variant ID for the cheapest/default variant. Undefined for mock data. */
  variantId?: string;
  /** True when variants differ in price, so listings show "From ₹x". */
  hasPriceRange?: boolean;
  /** True when the customer must choose (size, pack, chain) before adding to the cart. */
  needsChoice?: boolean;
  /** Every variant. Only filled on the product page, where the choice is made. */
  variants?: ProductVariant[];
}

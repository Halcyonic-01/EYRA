export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  description: string;
  images: string[];
  inStock: number;
  type: "ring" | "chain" | "earring" | "bracelet" | "anklet";
  /** Medusa variant ID for the cheapest/default variant. Undefined for mock data. */
  variantId?: string;
}

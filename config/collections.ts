import type { Product } from "@/components/products/types";

/**
 * Every browsable collection on the storefront.
 *
 * A collection is defined by the product `type`s it includes, so a collection
 * can never point at inventory that does not exist. When a new product type is
 * added to the catalogue, add it here and the route, the index page, the
 * footer, and the homepage grid all pick it up automatically.
 */
export interface Collection {
  slug: string;
  /** Display name used in nav, headings, and breadcrumbs. */
  label: string;
  /** Short editorial line shown under the heading on the collection page. */
  description: string;
  /** Product types included in this collection. */
  types: ReadonlyArray<Product["type"]>;
  /** Tile image used on the collections index and the homepage grid. */
  image: string;
}

export const COLLECTIONS: readonly Collection[] = [
  {
    slug: "rings",
    label: "Rings",
    description:
      "Stacking bands, signets, and statement silhouettes in 925 sterling silver.",
    types: ["ring"],
    image: "/images/collection-1.jpg",
  },
  {
    slug: "necklaces",
    label: "Necklaces & Pendants",
    description:
      "Rope twists, serpentine links, and everyday pendants built to layer.",
    types: ["chain"],
    image: "/images/collection-2.jpg",
  },
  {
    slug: "anklets",
    label: "Anklets",
    description:
      "Fine chains and delicate charms in 925 sterling silver, light enough for every day.",
    types: ["anklet"],
    image: "/images/collection-anklets.jpg",
  },
  {
    slug: "bracelets",
    label: "Bracelets",
    description:
      "Cuffs and link bracelets in solid 925 sterling, sized to sit close.",
    types: ["bracelet"],
    image: "/images/product-4.jpg",
  },
  {
    slug: "for-her",
    label: "For Her",
    description:
      "Delicate rings and fine anklets designed for effortless everyday wear.",
    types: ["ring", "anklet"],
    image: "/images/for-her.jpg",
  },
  {
    slug: "for-him",
    label: "For Him",
    description:
      "Clean lines and structured weight, cut for a bold and modern look.",
    types: ["chain", "ring"],
    image: "/images/for-him.jpg",
  },
] as const;

/**
 * Legacy and colloquial slugs kept alive so older links, bookmarks, and any
 * indexed URLs resolve instead of 404ing. "Necklaces" is what customers search
 * for; "chain" is what the catalogue calls the same product type.
 */
const SLUG_ALIASES: Record<string, string> = {
  chains: "necklaces",
  chain: "necklaces",
  necklace: "necklaces",
  pendants: "necklaces",
  ring: "rings",
  anklet: "anklets",
  bracelet: "bracelets",
  her: "for-her",
  him: "for-him",
};

/**
 * Every slug the /collections/[slug] route is allowed to serve: the canonical
 * collections, their aliases, and the "new" recency view. The route sets
 * `dynamicParams = false` against this list so an unknown slug returns a real
 * HTTP 404 rather than a soft 404 rendered with a 200 status.
 */
export const ROUTABLE_SLUGS: readonly string[] = [
  ...COLLECTIONS.map((c) => c.slug),
  ...Object.keys(SLUG_ALIASES),
  "new",
];

/** Resolve a URL slug (including aliases) to a collection, or null. */
export function getCollection(slug: string): Collection | null {
  const normalized = SLUG_ALIASES[slug] ?? slug;
  return COLLECTIONS.find((c) => c.slug === normalized) ?? null;
}

/** Canonical slug for a given input slug, used to redirect aliases. */
export function canonicalSlug(slug: string): string | null {
  const alias = SLUG_ALIASES[slug];
  return alias && alias !== slug ? alias : null;
}

/** Filter a product list down to the ones belonging to a collection. */
export function filterByCollection(
  products: Product[],
  collection: Collection
): Product[] {
  return products.filter((p) => collection.types.includes(p.type));
}

import type { Audience, Product } from "@/components/products/types";

/**
 * Every browsable collection on the storefront.
 *
 * A collection is defined by the product `type`s it includes, the `audiences`
 * (Medusa categories MEN, WOMEN, COUPLE) it includes, or both. A product must
 * match every rule the collection sets. When a new product type is added to
 * the catalogue, add it here and the route, the index page, the footer, and the
 * homepage grid all pick it up automatically.
 */
export interface Collection {
  slug: string;
  /** Display name used in nav, headings, and breadcrumbs. */
  label: string;
  /** Short editorial line shown under the heading on the collection page. */
  description: string;
  /** Product types included in this collection. Omit to include every type. */
  types?: ReadonlyArray<Product["type"]>;
  /** Audiences included in this collection. Omit to include every audience. */
  audiences?: ReadonlyArray<Audience>;
  /** Product types left out even when they match the audience. Omit to leave none out. */
  excludeTypes?: ReadonlyArray<Product["type"]>;
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
    image: "/images/collection-2.jpg",
  },
  {
    slug: "pendants",
    label: "Pendants",
    description:
      "Rope twists, serpentine links, and everyday pendants built to layer.",
    types: ["pendant"],
    image: "/images/collection-1.jpg",
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
    audiences: ["women", "couple"],
    image: "/images/for-her.jpg",
  },
  {
    slug: "for-him",
    label: "For Him",
    description:
      "Clean lines and structured weight, cut for a bold and modern look.",
    audiences: ["men", "couple"],
    excludeTypes: ["anklet"],
    image: "/images/for-him.jpg",
  },
] as const;

/**
 * Legacy and colloquial slugs kept alive so older links, bookmarks, and any
 * indexed URLs resolve instead of 404ing. Old necklace URLs redirect to pendants.
 * "chain" is what the catalogue calls the same product type.
 */
const SLUG_ALIASES: Record<string, string> = {
  chains: "pendants",
  chain: "pendants",
  necklace: "pendants",
  necklaces: "pendants",
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

/**
 * The collections a page can be narrowed by. An audience page (For Her, For Him)
 * narrows by product type, and a product-type page (Rings, Pendants) narrows by
 * audience. A collection that sets neither returns an empty list.
 */
export function getNarrowingCollections(collection: Collection): Collection[] {
  if (collection.audiences) {
    const excluded = collection.excludeTypes ?? [];
    return COLLECTIONS.filter(
      (c) =>
        c.types &&
        !c.audiences &&
        c.types.every((t) => !excluded.includes(t))
    );
  }
  if (collection.types) {
    return COLLECTIONS.filter((c) => c.audiences && !c.types);
  }
  return [];
}

/** Filter a product list down to the ones belonging to a collection. */
export function filterByCollection(
  products: Product[],
  collection: Collection
): Product[] {
  const { types, audiences, excludeTypes } = collection;
  return products.filter(
    (p) =>
      (!types || types.includes(p.type)) &&
      (!excludeTypes || !excludeTypes.includes(p.type)) &&
      (!audiences || (p.audiences ?? []).some((a) => audiences.includes(a)))
  );
}

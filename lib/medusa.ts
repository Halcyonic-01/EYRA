/**
 * Medusa Store API v2 client.
 *
 * Env vars required in production:
 *   NEXT_PUBLIC_MEDUSA_BACKEND_URL      e.g. https://api.eyra.com
 *   NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY  publishable API key from Medusa dashboard
 *
 * In development, if the backend is unreachable the functions fall back to the
 * static mock data in lib/products.ts so the UI remains fully functional.
 */

import type { Product } from "@/components/products/types";
import type { DetailProduct } from "@/lib/products";

/* ── Config ───────────────────────────────────────────────── */

const BASE_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

/**
 * Medusa v2 stores/returns amounts in MAJOR units, not the smallest currency
 * unit, ₹2,499 is `2499`, not `249900`. (Confirmed against the installed
 * @medusajs/pricing Price model and Medusa's own demo seed script.)
 */
const CURRENCY_CODE = "inr";

/* ── Raw Medusa Store API v2 shapes ───────────────────────── */

interface MedusaImage {
  id: string;
  url: string;
}

interface MedusaProductType {
  id: string;
  value: string;
}

interface MedusaProductTag {
  id: string;
  value: string;
}

interface MedusaOptionValue {
  id: string;
  value: string;
}

interface MedusaProductOption {
  id: string;
  title: string;
  values: MedusaOptionValue[];
}

interface MedusaCalculatedPrice {
  calculated_amount: number;
  original_amount: number;
  currency_code: string;
}

interface MedusaVariantOption {
  option_id: string;
  value: string;
}

interface MedusaVariant {
  id: string;
  title: string;
  inventory_quantity: number;
  calculated_price: MedusaCalculatedPrice | null;
  options: MedusaVariantOption[];
}

interface MedusaProduct {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  thumbnail: string | null;
  images: MedusaImage[];
  type: MedusaProductType | null;
  tags: MedusaProductTag[] | null;
  options: MedusaProductOption[];
  variants: MedusaVariant[];
  metadata: Record<string, unknown> | null;
}

interface MedusaListResponse {
  products: MedusaProduct[];
  count: number;
  offset: number;
  limit: number;
}

interface MedusaSingleResponse {
  product: MedusaProduct;
}

/* ── Base fetch ───────────────────────────────────────────── */

async function medusaFetch<T>(
  path: string,
  searchParams?: Record<string, string>,
  init?: RequestInit
): Promise<T | null> {
  const url = new URL(`${BASE_URL}${path}`);

  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  try {
    const res = await fetch(url.toString(), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(PUB_KEY ? { "x-publishable-api-key": PUB_KEY } : {}),
        ...(init?.headers ?? {}),
      },
      // ISR: revalidate every 60s, or on-demand via /api/revalidate when the
      // caller tags the request (see getProducts/getProductByHandle).
      next: { revalidate: 60, ...(init?.next ?? {}) },
    });

    if (!res.ok) {
      console.error(`[medusa] ${res.status} ${res.statusText}, ${url.toString()}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error("[medusa] fetch error:", err);
    return null;
  }
}

/**
 * Resolve the Medusa region ID for CURRENCY_CODE.
 *
 * The Store API's /store/products endpoint takes `region_id`, not
 * `currency_code`, passing currency_code directly is rejected as an
 * unrecognized param. Cached at module scope since regions rarely change.
 */
let cachedRegionId: string | null = null;

async function getRegionId(): Promise<string | undefined> {
  if (cachedRegionId) return cachedRegionId;

  const data = await medusaFetch<{ regions: { id: string; currency_code: string }[] }>(
    "/store/regions",
    { limit: "100" }
  );
  if (!data) return undefined;

  const region = data.regions.find((r) => r.currency_code === CURRENCY_CODE) ?? data.regions[0];
  if (region) cachedRegionId = region.id;
  return cachedRegionId ?? undefined;
}

/* ── Normalizers ──────────────────────────────────────────── */

/**
 * Map Medusa's open-ended product type to the three types our UI understands.
 * Falls back to keyword matching on title/handle before defaulting to "ring".
 */
function normalizeType(p: MedusaProduct): "ring" | "chain" | "earring" | "bracelet" | "anklet" {
  const raw = p.type?.value?.toLowerCase() ?? "";
  if (raw === "ring" || raw === "chain" || raw === "earring" || raw === "bracelet" || raw === "anklet") {
    return raw;
  }
  const text = `${p.title} ${p.handle}`.toLowerCase();
  // Anklets are checked first: an "ankle bracelet" is an anklet, not a bracelet.
  if (text.includes("anklet") || text.includes("ankle bracelet")) return "anklet";
  // Bracelets are checked before chains: a "bracelet chain" is a bracelet.
  if (text.includes("bracelet") || text.includes("bangle") || text.includes("cuff bracelet")) {
    return "bracelet";
  }
  if (text.includes("chain") || text.includes("link") || text.includes("necklace") || text.includes("pendant")) return "chain";
  if (
    text.includes("earring") ||
    text.includes("ear cuff") ||
    text.includes("stud") ||
    text.includes("hoop") ||
    text.includes("drop ear")
  ) return "earring";
  return "ring";
}

/**
 * Extract the cheapest variant's calculated price pair and its Medusa variant ID.
 * Falls back to zeroes if no pricing context was provided (no region/currency param).
 */
function extractPrice(variants: MedusaVariant[]): {
  price: number;
  originalPrice: number;
  cheapestVariantId: string | undefined;
} {
  if (variants.length === 0) return { price: 0, originalPrice: 0, cheapestVariantId: undefined };

  const cheapest = variants.reduce((min, v) => {
    const minAmt = min.calculated_price?.calculated_amount ?? Infinity;
    const vAmt = v.calculated_price?.calculated_amount ?? Infinity;
    return vAmt < minAmt ? v : min;
  });

  if (!cheapest.calculated_price) {
    return { price: 0, originalPrice: 0, cheapestVariantId: cheapest.id };
  }

  const price = Math.round(cheapest.calculated_price.calculated_amount);
  const originalRaw = cheapest.calculated_price.original_amount;
  const originalPrice =
    originalRaw > cheapest.calculated_price.calculated_amount
      ? Math.round(originalRaw)
      : Math.round(price * 1.6); // synthetic MRP if no compare-at price set

  return { price, originalPrice, cheapestVariantId: cheapest.id };
}

/** Build an ordered image URL array. Thumbnail goes first if present. */
function extractImages(p: MedusaProduct): string[] {
  const urls = p.images?.map((i) => i.url).filter(Boolean) ?? [];
  if (p.thumbnail && !urls.includes(p.thumbnail)) {
    urls.unshift(p.thumbnail);
  }
  return urls.length > 0 ? urls : ["/images/product-1.jpg"];
}

/**
 * Convert a raw Medusa product to the lean Product shape used in listings
 * and the cart/wishlist stores. The `id` field is set to the Medusa handle so
 * product URLs are human-readable (/products/eyra-signature-silver-ring).
 */
function toProduct(p: MedusaProduct): Product {
  const { price, originalPrice, cheapestVariantId } = extractPrice(p.variants);
  const inStock = p.variants.reduce((s, v) => s + (v.inventory_quantity ?? 0), 0);

  return {
    id: p.handle,
    name: p.title,
    price,
    originalPrice,
    description: p.description ?? "",
    images: extractImages(p),
    inStock,
    type: normalizeType(p),
    variantId: cheapestVariantId,
  };
}

/**
 * Convert a raw Medusa product to the richer DetailProduct shape used on the
 * product detail page. Requires the options, options.values, and tags
 * relations to be expanded in the fetch.
 */
function toDetailProduct(p: MedusaProduct): DetailProduct {
  const base = toProduct(p);

  // Ring sizes come from a product option titled "Size" or "Ring Size"
  const sizeOption = p.options.find((o) =>
    o.title.toLowerCase().includes("size")
  );
  const sizes: number[] = sizeOption
    ? sizeOption.values
        .map((v) => parseInt(v.value, 10))
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b)
    : [];

  // Quality badges come from Medusa product tags; fall back to sensible defaults
  const defaultSpecs: Record<"ring" | "chain" | "earring" | "bracelet" | "anklet", string[]> = {
    ring: ["925 Sterling", "Hallmarked", "BIS Certified", "Anti-tarnish"],
    chain: ["925 Sterling", "Nickel Free", "Hallmarked", "Anti-tarnish"],
    earring: ["925 Sterling", "Anti-tarnish", "Hypoallergenic", "Hallmarked"],
    bracelet: ["925 Sterling", "Hallmarked", "BIS Certified", "Anti-tarnish"],
    anklet: ["925 Sterling", "Hallmarked", "BIS Certified", "Anti-tarnish"],
  };
  const specs =
    p.tags && p.tags.length > 0
      ? p.tags.map((t) => t.value)
      : defaultSpecs[base.type];

  // Ratings and review counts are stored in Medusa product metadata
  const rating =
    typeof p.metadata?.rating === "number" ? p.metadata.rating : 0;
  const reviewCount =
    typeof p.metadata?.review_count === "number" ? p.metadata.review_count : 0;

  // Build size → variant_id lookup so the detail page can pass the correct
  // variantId to addToCart when the user selects a ring size.
  const sizeVariantMap: Record<string, string> = {};
  if (sizeOption) {
    for (const variant of p.variants) {
      const sizeOpt = variant.options.find((o) => o.option_id === sizeOption.id);
      if (sizeOpt) sizeVariantMap[sizeOpt.value] = variant.id;
    }
  }

  return { ...base, specs, sizes, rating, reviewCount, sizeVariantMap };
}

/* ── Fallback helpers (development only) ─────────────────── */

async function mockProducts(): Promise<Product[]> {
  const { PRODUCTS } = await import("@/lib/products");
  return PRODUCTS;
}

async function mockDetailProduct(handle: string): Promise<DetailProduct | null> {
  const { getProductById } = await import("@/lib/products");
  return getProductById(handle) ?? null;
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Fetch all published products from the Medusa store.
 *
 * Falls back to static mock data in development when the backend is unreachable,
 * so the UI works before Medusa is wired up.
 */
export async function getProducts(): Promise<Product[]> {
  const regionId = await getRegionId();

  const data = await medusaFetch<MedusaListResponse>(
    "/store/products",
    {
      limit: "100",
      ...(regionId ? { region_id: regionId } : {}),
      fields: [
        "id", "title", "handle", "description", "thumbnail",
        "*images", "*type", "*tags", "*variants", "*variants.calculated_price",
      ].join(","),
    },
    { next: { tags: ["products"] } }
  );

  if (!data) {
    if (process.env.NODE_ENV !== "production") return mockProducts();
    return [];
  }

  return data.products.map(toProduct);
}

/**
 * Fetch a single product by its URL handle (or, as a fallback, by Medusa product ID).
 *
 * Expanding options and their values is required so ring sizes can be parsed.
 * Tags are expanded so quality spec badges appear correctly.
 */
export async function getProductByHandle(handle: string): Promise<DetailProduct | null> {
  const expandFields = [
    "id", "title", "handle", "description", "thumbnail", "metadata",
    "*images", "*type", "*tags",
    "*options", "*options.values",
    "*variants", "*variants.options", "*variants.calculated_price",
  ].join(",");

  const regionId = await getRegionId();

  // Primary: query by handle
  const byHandle = await medusaFetch<MedusaListResponse>(
    "/store/products",
    {
      handle,
      ...(regionId ? { region_id: regionId } : {}),
      fields: expandFields,
    },
    { next: { tags: ["products"] } }
  );

  if (byHandle?.products[0]) return toDetailProduct(byHandle.products[0]);

  // Secondary: handle might actually be a Medusa product ID (prod_01...)
  const byId = await medusaFetch<MedusaSingleResponse>(
    `/store/products/${handle}`,
    {
      ...(regionId ? { region_id: regionId } : {}),
      fields: expandFields,
    },
    { next: { tags: ["products"] } }
  );

  if (byId?.product) return toDetailProduct(byId.product);

  // Development fallback
  if (process.env.NODE_ENV !== "production") return mockDetailProduct(handle);

  return null;
}

/**
 * Return up to `limit` products that are similar to the given one.
 * Same product type is shown first; other types fill the remainder.
 */
export async function getSimilarProducts(
  handle: string,
  limit = 8
): Promise<Product[]> {
  const [current, all] = await Promise.all([
    getProductByHandle(handle),
    getProducts(),
  ]);

  if (!current) return all.slice(0, limit);

  const others = all.filter((p) => p.id !== handle);
  const sameType = others.filter((p) => p.type === current.type);
  const rest = others.filter((p) => p.type !== current.type);

  return [...sameType, ...rest].slice(0, limit);
}

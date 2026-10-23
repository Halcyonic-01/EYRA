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

import type { Product, ProductChoice, ProductVariant } from "@/components/products/types";
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
  /** Variants that are not stock-managed are always available. */
  manage_inventory?: boolean;
  allow_backorder?: boolean;
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
 * Map Medusa's open-ended product type to the types our UI understands.
 * Falls back to keyword matching on title/handle before defaulting to "ring".
 */
function normalizeType(p: MedusaProduct): "ring" | "chain" | "bracelet" | "anklet" {
  const raw = p.type?.value?.toLowerCase() ?? "";
  if (raw === "ring" || raw === "chain" || raw === "bracelet" || raw === "anklet") {
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
 * A variant is available when it is not stock-managed, allows backorders, or has
 * stock. Medusa leaves the quantity out for variants it does not track.
 */
function variantStock(v: MedusaVariant): number {
  if (v.manage_inventory === false || v.allow_backorder === true) return 999;
  return v.inventory_quantity ?? 0;
}

/**
 * Convert a raw Medusa product to the lean Product shape used in listings
 * and the cart/wishlist stores. The `id` field is set to the Medusa handle so
 * product URLs are human-readable (/products/eyra-signature-silver-ring).
 */
function toProduct(p: MedusaProduct): Product {
  const { price, originalPrice, cheapestVariantId } = extractPrice(p.variants);
  const inStock = p.variants.reduce((s, v) => s + variantStock(v), 0);
  const prices = new Set(
    p.variants
      .map((v) => v.calculated_price?.calculated_amount)
      .filter((amount): amount is number => typeof amount === "number")
  );

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
    hasPriceRange: prices.size > 1,
    needsChoice: p.variants.length > 1,
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
  const defaultSpecs: Record<"ring" | "chain" | "bracelet" | "anklet", string[]> = {
    ring: ["925 Sterling", "Hallmarked", "BIS Certified", "Anti-tarnish"],
    chain: ["925 Sterling", "Nickel Free", "Hallmarked", "Anti-tarnish"],
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

  // Every variant with its own price, so the page and the cart show what Medusa charges.
  const optionTitleById = new Map(p.options.map((o) => [o.id, o.title]));
  const variants: ProductVariant[] = p.variants.map((v) => {
    const amount = v.calculated_price?.calculated_amount ?? 0;
    const original = v.calculated_price?.original_amount ?? 0;
    const options: Record<string, string> = {};
    for (const o of v.options) {
      const title = optionTitleById.get(o.option_id);
      if (title) options[title] = o.value;
    }
    return {
      id: v.id,
      title: v.title,
      price: Math.round(amount),
      originalPrice: original > amount ? Math.round(original) : Math.round(amount * 1.6),
      inStock: variantStock(v),
      options,
    };
  });

  // Choices other than ring size: a "Title" option with one value is Medusa's
  // placeholder for a product with no options, so it is not a choice.
  const choices: ProductChoice[] = p.options
    .filter((o) => o !== sizeOption && !(o.title === "Title" && o.values.length <= 1))
    .map((o) => ({ title: o.title, values: o.values.map((v) => v.value) }))
    .filter((c) => c.values.length > 0);

  return {
    ...base,
    specs,
    sizes,
    rating,
    reviewCount,
    sizeVariantMap,
    variants,
    choices,
    sizeOptionTitle: sizeOption?.title,
  };
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
 * Products that exist only to travel with an order, such as the complimentary
 * tote bag, carry metadata.hidden_from_shop. They are published (Medusa only
 * lets a published product into a cart) but are never listed or opened.
 */
function isHiddenFromShop(product: { metadata?: Record<string, unknown> | null }): boolean {
  const flag = product.metadata?.hidden_from_shop;
  return flag === true || flag === "true";
}

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
        "id", "title", "handle", "description", "thumbnail", "metadata",
        "*images", "*type", "*tags", "*variants", "+variants.inventory_quantity", "*variants.calculated_price",
      ].join(","),
    },
    { next: { tags: ["products"] } }
  );

  if (!data) {
    if (process.env.NODE_ENV !== "production") return mockProducts();
    return [];
  }

  return data.products.filter((product) => !isHiddenFromShop(product)).map(toProduct);
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
    "*variants", "+variants.inventory_quantity", "*variants.options", "*variants.calculated_price",
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

  if (byHandle?.products[0]) {
    return isHiddenFromShop(byHandle.products[0]) ? null : toDetailProduct(byHandle.products[0]);
  }

  // Secondary: handle might actually be a Medusa product ID (prod_01...)
  const byId = await medusaFetch<MedusaSingleResponse>(
    `/store/products/${handle}`,
    {
      ...(regionId ? { region_id: regionId } : {}),
      fields: expandFields,
    },
    { next: { tags: ["products"] } }
  );

  if (byId?.product) return isHiddenFromShop(byId.product) ? null : toDetailProduct(byId.product);

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

/* ── Exchange options ─────────────────────────────────────── */

/** One thing a customer can exchange for: a variant that is on sale and in stock. */
export interface ExchangeOption {
  variantId: string;
  /** For example "Celestial Band Ring · 12". */
  label: string;
  price: number;
  /** The product's handle, so options of the same product can be listed first. */
  productId: string;
}

/**
 * Every size and design a customer could exchange for. Only what is on sale
 * (published, not a hidden product like the tote), priced, and in stock is
 * listed. It is a convenience: the backend checks the choice again, and reads
 * the price from Medusa, when the exchange is asked for.
 */
export async function getExchangeOptions(): Promise<ExchangeOption[]> {
  const regionId = await getRegionId();
  const data = await medusaFetch<MedusaListResponse>(
    "/store/products",
    {
      limit: "100",
      ...(regionId ? { region_id: regionId } : {}),
      fields: ["id", "title", "handle", "metadata", "*options", "*variants", "+variants.inventory_quantity", "*variants.options", "*variants.calculated_price"].join(","),
    },
    { next: { tags: ["products"] } }
  );
  if (!data) return [];

  const options: ExchangeOption[] = [];
  for (const product of data.products) {
    if (isHiddenFromShop(product)) continue;
    for (const variant of product.variants) {
      const price = variant.calculated_price?.calculated_amount;
      if (typeof price !== "number" || price <= 0 || variantStock(variant) < 1) continue;
      const chosen = variant.options
        .map((option) => option.value)
        .filter((value) => value && value !== "Default Title" && value !== "Default");
      options.push({
        variantId: variant.id,
        label: [product.title, ...chosen].join(" · "),
        price: Math.round(price),
        productId: product.handle,
      });
    }
  }
  return options;
}

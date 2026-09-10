/**
 * Server-only: wishlist persistence via Medusa Admin API.
 *
 * Medusa has no native wishlist concept, so entries are stored as a plain
 * array under the customer's `metadata.wishlist` key. Metadata updates are
 * merged at the top level by Medusa, so writing `{ metadata: { wishlist } }`
 * replaces only that key, other metadata is untouched.
 *
 * Required env vars:
 *   MEDUSA_ADMIN_API_KEY  , Admin API token from the Medusa dashboard
 *   NEXT_PUBLIC_MEDUSA_BACKEND_URL, e.g. http://localhost:9000
 */
import "server-only";

const BASE_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

const ADMIN_KEY = process.env.MEDUSA_ADMIN_API_KEY ?? "";

export interface WishlistEntry {
  /** Medusa product handle, matches Product.id in the storefront. */
  productId: string;
  variantId?: string;
  /**
   * Ring size the entry was saved at, when one was chosen. variantId alone
   * identifies the SKU for Medusa but carries no human-readable size, so
   * without this the cart line created from a wishlist entry could not show
   * the customer which size they were about to buy.
   */
  size?: number | null;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!ADMIN_KEY) {
    console.warn("[medusa-wishlist] MEDUSA_ADMIN_API_KEY is not set, skipping wishlist sync");
    return null;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        // Secret API keys (sk_...) authenticate via HTTP Basic, not a
        // custom header or Bearer, see lib/medusa-customer.ts for detail.
        Authorization: `Basic ${ADMIN_KEY}`,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[medusa-wishlist] ${res.status} ${res.statusText}, ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("[medusa-wishlist] fetch error:", err);
    return null;
  }
}

function isWishlistEntry(v: unknown): v is WishlistEntry {
  if (typeof v !== "object" || v === null) return false;
  const { productId, variantId, size } = v as Record<string, unknown>;
  if (typeof productId !== "string") return false;
  if (variantId !== undefined && typeof variantId !== "string") return false;
  // Entries written before size was stored simply have none, so absent and
  // null both stay valid rather than dropping the whole entry.
  if (size !== undefined && size !== null && typeof size !== "number") return false;
  return true;
}

/** Read the customer's stored wishlist. Returns [] if unset, unreachable, or malformed. */
export async function getWishlistEntries(customerId: string): Promise<WishlistEntry[]> {
  const data = await adminFetch<{ customer?: { metadata?: Record<string, unknown> | null } }>(
    `/admin/customers/${customerId}?fields=id,metadata`
  );
  const raw = data?.customer?.metadata?.wishlist;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isWishlistEntry);
}

/** Overwrite the customer's stored wishlist. Returns false on failure. */
export async function setWishlistEntries(
  customerId: string,
  entries: WishlistEntry[]
): Promise<boolean> {
  const data = await adminFetch(`/admin/customers/${customerId}`, {
    method: "POST",
    body: JSON.stringify({ metadata: { wishlist: entries } }),
  });
  return data !== null;
}

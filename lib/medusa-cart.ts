/**
 * Medusa Store Cart API v2, client-only helpers.
 *
 * Import only from Zustand store actions or client components.
 * All cart mutations return the server-confirmed totals so the store
 * can reflect Medusa's tax and regional pricing rules immediately.
 */

const BASE_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

/** localStorage key for persisting the cart ID across browser sessions. */
export const CART_ID_KEY = "eyra_cart_id";

/**
 * Medusa v2 stores/returns amounts in MAJOR units, not the smallest currency
 * unit, ₹2,499 is `2499`, not `249900`.
 */

/* ── Raw Medusa cart types ────────────────────────────────── */

interface RawLineItem {
  id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  title: string;
  thumbnail: string | null;
}

interface RawCart {
  id: string;
  items: RawLineItem[];
  subtotal: number;
  tax_total: number;
  shipping_total: number;
  discount_total: number;
  total: number;
  /** Wallet credit on the cart. Medusa's `total` is already net of it. */
  credit_line_total?: number;
  currency_code: string;
}

interface CartResponse {
  cart: RawCart;
}

/* ── Public types ─────────────────────────────────────────── */

export interface CartLineItemSummary {
  id: string;
  variantId: string;
  quantity: number;
  unitPrice: number;    // in rupees
  subtotal: number;     // in rupees
  title: string;
  thumbnail: string | null;
}

/** Server-confirmed totals, rupees, as returned by Medusa. */
export interface CartTotals {
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
}

/* ── localStorage helpers ─────────────────────────────────── */

export function getStoredCartId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CART_ID_KEY);
}

export function setStoredCartId(id: string): void {
  if (typeof window !== "undefined") localStorage.setItem(CART_ID_KEY, id);
}

export function clearStoredCartId(): void {
  if (typeof window !== "undefined") localStorage.removeItem(CART_ID_KEY);
}

/* ── Base fetch ───────────────────────────────────────────── */

/**
 * Thrown when Medusa actually responded and rejected the request, e.g.
 * insufficient_inventory. Distinct from a request that never got a response
 * at all (network drop, or the page navigating away mid-flight aborts the
 * fetch), which cartFetch instead resolves to null for. The distinction lets
 * callers roll back optimistic UI state only when they have a definitive
 * "no" from the server, rather than on any inconclusive failure to hear back.
 */
export class CartRequestRejected extends Error {
  constructor(public status: number, url: string) {
    super(`Medusa rejected ${url} with ${status}`);
    this.name = "CartRequestRejected";
  }
}

async function cartFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const url = `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(PUB_KEY ? { "x-publishable-api-key": PUB_KEY } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    // The request never completed, could be offline, CORS, or the browser
    // aborting it because the page is navigating away. We can't tell which,
    // so this resolves to null (inconclusive) rather than throwing.
    console.error("[medusa-cart] fetch error:", err);
    return null;
  }
  if (!res.ok) {
    console.error(`[medusa-cart] ${res.status} ${res.statusText}, ${url}`);
    throw new CartRequestRejected(res.status, url);
  }
  return (await res.json()) as T;
}

/* ── Normalizers ──────────────────────────────────────────── */

function normalizeTotals(cart: RawCart): CartTotals {
  return {
    subtotal: Math.round(cart.subtotal),
    taxTotal: Math.round(cart.tax_total),
    shippingTotal: Math.round(cart.shipping_total),
    discountTotal: Math.round(cart.discount_total),
    // Wallet credit is a way of paying, not a price change, so the cart always
    // shows the full total. Checkout shows the credit as its own line.
    total: Math.round(cart.total + (cart.credit_line_total ?? 0)),
  };
}

function normalizeLineItems(items: RawLineItem[]): CartLineItemSummary[] {
  return items.map((i) => ({
    id: i.id,
    variantId: i.variant_id,
    quantity: i.quantity,
    unitPrice: Math.round(i.unit_price),
    subtotal: Math.round(i.subtotal),
    title: i.title,
    thumbnail: i.thumbnail,
  }));
}

/* ── Cart session ─────────────────────────────────────────── */

/** Create a new cart on the Medusa backend and persist its ID. */
export async function createCart(): Promise<string | null> {
  const data = await cartFetch<CartResponse>("/store/carts", {
    method: "POST",
    body: JSON.stringify({ currency_code: "inr" }),
  });
  if (!data?.cart?.id) return null;
  setStoredCartId(data.cart.id);
  return data.cart.id;
}

/**
 * Return the stored cart ID, creating a new cart if none exists.
 * Safe to call multiple times, only creates one cart per session.
 */
export async function getOrCreateCartId(): Promise<string | null> {
  const stored = getStoredCartId();
  if (stored) return stored;
  return createCart();
}

/* ── Line item mutations ──────────────────────────────────── */

export interface AddLineItemResult {
  lineItemId: string;
  totals: CartTotals;
}

/**
 * Add a variant to the cart.
 * Returns the new line item ID (needed for future updateQuantity / remove calls)
 * and the server-confirmed cart totals with regional taxes applied.
 */
export async function addCartLineItem(
  cartId: string,
  variantId: string,
  quantity: number
): Promise<AddLineItemResult | null> {
  const data = await cartFetch<CartResponse>(
    `/store/carts/${cartId}/line-items`,
    {
      method: "POST",
      body: JSON.stringify({ variant_id: variantId, quantity }),
    }
  );
  if (!data?.cart) return null;

  // Medusa merges duplicate variant_ids, so find by variantId
  const lineItem = data.cart.items.find((i) => i.variant_id === variantId);
  if (!lineItem) return null;

  return { lineItemId: lineItem.id, totals: normalizeTotals(data.cart) };
}

/**
 * Update the quantity of an existing line item.
 * Passing quantity = 0 will remove the item; prefer removeCartLineItem for clarity.
 */
export async function updateCartLineItem(
  cartId: string,
  lineItemId: string,
  quantity: number
): Promise<CartTotals | null> {
  const data = await cartFetch<CartResponse>(
    `/store/carts/${cartId}/line-items/${lineItemId}`,
    {
      method: "POST",
      body: JSON.stringify({ quantity }),
    }
  );
  return data?.cart ? normalizeTotals(data.cart) : null;
}

/** Remove a line item and return the updated cart totals. */
export async function removeCartLineItem(
  cartId: string,
  lineItemId: string
): Promise<CartTotals | null> {
  const data = await cartFetch<CartResponse>(
    `/store/carts/${cartId}/line-items/${lineItemId}`,
    { method: "DELETE" }
  );
  return data?.cart ? normalizeTotals(data.cart) : null;
}

/* ── Cart recovery ────────────────────────────────────────── */

export interface FetchedCart {
  lineItems: CartLineItemSummary[];
  totals: CartTotals;
}

/**
 * Fetch a full cart by ID, used on app startup to reconnect a persisted session.
 * Returns null if the cart has expired or the backend is unreachable.
 */
export async function fetchCart(cartId: string): Promise<FetchedCart | null> {
  const data = await cartFetch<CartResponse>(`/store/carts/${cartId}`);
  if (!data?.cart) return null;
  return {
    lineItems: normalizeLineItems(data.cart.items),
    totals: normalizeTotals(data.cart),
  };
}

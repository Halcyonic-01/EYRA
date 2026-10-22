/**
 * Medusa Store Cart API v2, client-only helpers.
 *
 * Import only from Zustand store actions or client components.
 *
 * Every mutation is followed by the backend's reconcile call, which keeps the
 * complimentary tote bag right and answers with the cart as the storefront
 * shows it: each line at the price Medusa charges, and the discount, shipping
 * and total worked out by the backend. Nothing here adds up a price itself.
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

/* ── The backend's cart summary ───────────────────────────── */

export type PaymentMode = "prepaid" | "cod";

/** One line of the cart, as the backend reports it (amounts in rupees). */
export interface SummaryLine {
  id: string;
  variant_id: string | null;
  product_id: string | null;
  product_handle: string | null;
  title: string;
  product_title: string | null;
  variant_title: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  thumbnail: string | null;
  /** True for the free tote bag: not for the customer to change or remove. */
  complimentary: boolean;
}

export interface CartSummary {
  id: string;
  email: string | null;
  customer_id: string | null;
  /** True once the cart has become an order. */
  completed: boolean;
  items: SummaryLine[];
  totals: {
    /** Price of the items before any discount, without shipping. */
    items_subtotal: number;
    discount_total: number;
    tax_total: number;
    /** 0 for prepaid, the Cash on Delivery charge for COD. */
    shipping_total: number;
    wallet_credit: number;
    /** What is left to pay, after wallet credit. */
    total: number;
  };
  promo_codes: string[];
  payment_mode: PaymentMode | null;
  /** Whether the items qualify for the complimentary tote, and whether it is in the cart. */
  tote: { qualifies: boolean; in_cart: boolean };
}

/* ── Public types ─────────────────────────────────────────── */

/** Server-confirmed totals, rupees. */
export interface CartTotals {
  /** Price of the items before any discount, without shipping. */
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  /** Wallet credit on the cart, which `total` is already net of. */
  walletCredit: number;
  /** What is left to pay. */
  total: number;
  promoCodes: string[];
  paymentMode: PaymentMode | null;
  /** The complimentary tote: whether the order qualifies, and whether it is in the cart. */
  tote: { qualifies: boolean; inCart: boolean };
}

export function totalsFromSummary(summary: CartSummary): CartTotals {
  const t = summary.totals;
  return {
    subtotal: Math.round(t.items_subtotal),
    taxTotal: Math.round(t.tax_total),
    shippingTotal: Math.round(t.shipping_total),
    discountTotal: Math.round(t.discount_total),
    walletCredit: Math.round(t.wallet_credit),
    total: Math.round(t.total),
    promoCodes: summary.promo_codes,
    paymentMode: summary.payment_mode,
    tote: { qualifies: summary.tote.qualifies, inCart: summary.tote.in_cart },
  };
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

/* ── Cart session ─────────────────────────────────────────── */

/** Create a new cart on the Medusa backend and persist its ID. */
export async function createCart(): Promise<string | null> {
  const data = await cartFetch<{ cart: { id: string } }>("/store/carts", {
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

/* ── Cart summary ─────────────────────────────────────────── */

/**
 * Read the cart as the storefront shows it, from the backend. Read only. Null
 * when the request never completed.
 */
export async function fetchCartSummary(cartId: string): Promise<CartSummary | null> {
  const data = await cartFetch<{ cart: CartSummary }>(`/store/carts/${cartId}/summary`);
  return data?.cart ?? null;
}

/**
 * Ask the backend to bring the complimentary tote in line with the items (added
 * above ₹1,499 while in stock, taken off otherwise), and read the cart back.
 * Null when the request never completed.
 */
export async function reconcileCart(cartId: string): Promise<CartSummary | null> {
  const data = await cartFetch<{ cart: CartSummary }>(`/store/carts/${cartId}/reconcile`, { method: "POST" });
  return data?.cart ?? null;
}

/* ── Line item mutations ──────────────────────────────────── */

export interface AddLineItemResult {
  lineItemId: string;
  summary: CartSummary;
}

interface RawCartResponse {
  cart: { items: { id: string; variant_id: string }[] };
}

/**
 * Add a variant to the cart.
 * Returns the new line item ID (needed for future updateQuantity / remove calls)
 * and the cart summary, with the price Medusa charges for every line.
 */
export async function addCartLineItem(
  cartId: string,
  variantId: string,
  quantity: number
): Promise<AddLineItemResult | null> {
  const data = await cartFetch<RawCartResponse>(
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

  const summary = await reconcileCart(cartId);
  if (!summary) return null;

  return { lineItemId: lineItem.id, summary };
}

/**
 * Update the quantity of an existing line item.
 * Passing quantity = 0 will remove the item; prefer removeCartLineItem for clarity.
 */
export async function updateCartLineItem(
  cartId: string,
  lineItemId: string,
  quantity: number
): Promise<CartSummary | null> {
  const data = await cartFetch<RawCartResponse>(
    `/store/carts/${cartId}/line-items/${lineItemId}`,
    {
      method: "POST",
      body: JSON.stringify({ quantity }),
    }
  );
  if (!data?.cart) return null;
  return reconcileCart(cartId);
}

/** Remove a line item and return the cart summary. */
export async function removeCartLineItem(
  cartId: string,
  lineItemId: string
): Promise<CartSummary | null> {
  const data = await cartFetch<RawCartResponse>(
    `/store/carts/${cartId}/line-items/${lineItemId}`,
    { method: "DELETE" }
  );
  if (!data?.cart) return null;
  return reconcileCart(cartId);
}

/* ── Cart recovery ────────────────────────────────────────── */

/**
 * Fetch a full cart by ID, used on app startup to reconnect a persisted session.
 * Returns null if the cart has expired or the backend is unreachable.
 */
export async function fetchCart(cartId: string): Promise<CartSummary | null> {
  try {
    return await fetchCartSummary(cartId);
  } catch (err) {
    // The cart is gone (expired or already an order). Anything else is a
    // temporary failure and must not wipe the customer's cart.
    if (err instanceof CartRequestRejected && (err.status === 404 || err.status === 400)) {
      return null;
    }
    throw err;
  }
}

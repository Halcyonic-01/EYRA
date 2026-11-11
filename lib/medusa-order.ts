/**
 * Server-only: Medusa cart → order completion.
 *
 * Shared by the two independent confirmation paths for a prepaid order:
 *   - /api/razorpay/verify   (client redirect, fast path)
 *   - /api/razorpay/webhook  (Razorpay callback, guaranteed path)
 *
 * Both must produce exactly one order, so completion lives here rather than
 * being duplicated per route.
 */
import "server-only";

import { setCartPaymentMode } from "@/lib/medusa-commerce";
import type { PaymentMode } from "@/lib/medusa-cart";

const BASE_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

// Fail instead of hanging when the backend (or its Redis) does not answer; callers retry.
const MEDUSA_TIMEOUT_MS = 25000;

const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

function storeHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(PUB_KEY ? { "x-publishable-api-key": PUB_KEY } : {}),
  };
}

/* ── Cart snapshot ────────────────────────────────────────── */

interface RawCartResponse {
  cart?: {
    id: string;
    total: number;
    currency_code: string;
    completed_at?: string | null;
    items?: unknown[];
  };
}

export interface CartSnapshot {
  id: string;
  /** Total in rupees (Medusa v2 stores/returns major units, not paise). */
  total: number;
  currencyCode: string;
  /** Set once the cart has become an order; null while the cart is still open. */
  completedAt: string | null;
  /** Line item count, a cart with 0 items must never be allowed to complete. */
  itemCount: number;
}

/**
 * Read a cart without mutating it. Used by the webhook to check whether the
 * cart was already completed by the client path and to compare the paid amount
 * against what the cart actually owes.
 *
 * Returns null when the cart is unknown or the backend is unreachable, the
 * caller cannot distinguish these, so treat null as "retry later".
 */
export async function fetchCartSnapshot(cartId: string): Promise<CartSnapshot | null> {
  try {
    const res = await fetch(`${BASE_URL}/store/carts/${cartId}`, {
      signal: AbortSignal.timeout(MEDUSA_TIMEOUT_MS),
      headers: storeHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[medusa-order] cart fetch ${res.status} ${res.statusText}, ${cartId}`);
      return null;
    }

    const data = (await res.json()) as RawCartResponse;
    if (!data.cart) return null;

    return {
      id: data.cart.id,
      total: data.cart.total,
      currencyCode: data.cart.currency_code,
      completedAt: data.cart.completed_at ?? null,
      itemCount: data.cart.items?.length ?? 0,
    };
  } catch (err) {
    console.error("[medusa-order] cart fetch error for", cartId, ":", err);
    return null;
  }
}

/* ── Checkout preparation ─────────────────────────────────── */

export interface CheckoutShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}

export function splitName(fullName: string): { first_name: string; last_name: string } {
  const [first_name, ...rest] = fullName.trim().split(/\s+/);
  return { first_name: first_name || fullName, last_name: rest.join(" ") };
}

/**
 * Push the shipping address/email onto the cart and set the shipping charge for
 * how it will be paid, both are required before Medusa will allow the cart to
 * complete. Call this once, before creating a payment collection, on every
 * checkout path. The mode comes from which route is calling, never from the
 * browser: prepaid orders ship free, Cash on Delivery orders carry the COD
 * charge, and the backend replaces any earlier charge so it is counted once.
 *
 * Returns false on failure; the caller should treat that as fatal for
 * this checkout attempt (completion will fail regardless).
 */
export async function prepareCartForCheckout(
  cartId: string,
  email: string,
  address: CheckoutShippingAddress,
  mode: PaymentMode
): Promise<boolean> {
  const { first_name, last_name } = splitName(address.fullName);

  try {
    const addressRes = await fetch(`${BASE_URL}/store/carts/${cartId}`, {
      signal: AbortSignal.timeout(MEDUSA_TIMEOUT_MS),
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify({
        email,
        shipping_address: {
          first_name,
          last_name,
          phone: address.phone,
          address_1: address.addressLine1,
          address_2: address.addressLine2 || null,
          city: address.city,
          province: address.state,
          postal_code: address.pincode,
          country_code: "in",
        },
      }),
    });
    if (!addressRes.ok) {
      console.error(
        `[medusa-order] cart address update ${addressRes.status} ${addressRes.statusText}, cart ${cartId}`
      );
      return false;
    }
  } catch (err) {
    console.error("[medusa-order] cart address update error for", cartId, ":", err);
    return false;
  }

  const priced = await setCartPaymentMode(cartId, mode);
  if (!priced.ok) {
    console.error(
      `[medusa-order] could not set the ${mode} shipping charge on cart ${cartId}: ${priced.message}`
    );
    return false;
  }

  return true;
}

/* ── Payment collection ───────────────────────────────────── */

interface MedusaPaymentSession {
  id: string;
  provider_id: string;
  data: Record<string, unknown>;
}

interface MedusaPaymentCollection {
  id: string;
  amount: number;
  payment_sessions?: MedusaPaymentSession[];
}

/**
 * Create (or reuse) the payment collection for a cart.
 *
 * Note: the correct endpoint is the top-level `/store/payment-collections`
 * with `cart_id` in the body, there is no `/store/carts/:id/payment-collection`
 * route in this Medusa version.
 */
export async function createPaymentCollection(cartId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/store/payment-collections`, {
      signal: AbortSignal.timeout(MEDUSA_TIMEOUT_MS),
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify({ cart_id: cartId }),
    });
    if (!res.ok) {
      console.error(
        `[medusa-order] payment collection ${res.status} ${res.statusText}, cart ${cartId}`
      );
      return null;
    }
    const body = (await res.json()) as { payment_collection?: { id: string } };
    return body.payment_collection?.id ?? null;
  } catch (err) {
    console.error("[medusa-order] payment collection error for cart", cartId, ":", err);
    return null;
  }
}

/** Initialize a payment session on a collection with the given provider. */
export async function initPaymentSession(
  collectionId: string,
  providerId: string
): Promise<MedusaPaymentCollection | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/store/payment-collections/${collectionId}/payment-sessions`,
      {
        signal: AbortSignal.timeout(MEDUSA_TIMEOUT_MS),
        method: "POST",
        headers: storeHeaders(),
        body: JSON.stringify({ provider_id: providerId }),
      }
    );
    if (!res.ok) {
      console.error(
        `[medusa-order] payment session ${res.status} ${res.statusText}, collection ${collectionId}`
      );
      return null;
    }
    const body = (await res.json()) as { payment_collection?: MedusaPaymentCollection };
    return body.payment_collection ?? null;
  } catch (err) {
    console.error("[medusa-order] payment session error for collection", collectionId, ":", err);
    return null;
  }
}

/* ── Razorpay payment with a price snapshot ───────────────── */

export type RazorpayCheckoutResult =
  | {
      ok: true;
      razorpayOrderId: string;
      collectionId: string;
      sessionId: string;
      /** What Razorpay will charge, in rupees, as the backend worked it out. */
      amount: number;
    }
  | { ok: false; status: number; message: string };

/**
 * Open the Razorpay payment for a cart. The backend reprices the cart to
 * today's prices, opens the payment and records what it costs, so a sale that
 * ends while the customer pays cannot fail their order. Nothing here is taken
 * from the browser.
 */
export async function startRazorpayCheckout(cartId: string): Promise<RazorpayCheckoutResult> {
  try {
    const res = await fetch(
      `${BASE_URL}/store/carts/${encodeURIComponent(cartId)}/razorpay-session`,
      { method: "POST", headers: storeHeaders(), body: "{}", cache: "no-store", signal: AbortSignal.timeout(MEDUSA_TIMEOUT_MS) }
    );
    const body = (await res.json().catch(() => ({}))) as {
      razorpay_order_id?: unknown;
      payment_collection_id?: unknown;
      payment_session_id?: unknown;
      amount?: unknown;
      message?: unknown;
    };
    if (!res.ok) {
      console.error(`[medusa-order] razorpay session ${res.status}, cart ${cartId}: ${String(body.message ?? "")}`);
      return {
        ok: false,
        status: res.status,
        message: typeof body.message === "string" ? body.message : "Payment could not be started.",
      };
    }
    if (
      typeof body.razorpay_order_id !== "string" ||
      typeof body.payment_collection_id !== "string" ||
      typeof body.payment_session_id !== "string" ||
      typeof body.amount !== "number"
    ) {
      return { ok: false, status: 502, message: "Payment could not be started." };
    }
    return {
      ok: true,
      razorpayOrderId: body.razorpay_order_id,
      collectionId: body.payment_collection_id,
      sessionId: body.payment_session_id,
      amount: body.amount,
    };
  } catch (err) {
    console.error("[medusa-order] razorpay session error for cart", cartId, ":", err);
    return { ok: false, status: 0, message: "Payment could not be started." };
  }
}

/* ── Completion ───────────────────────────────────────────── */

interface MedusaCompleteResponse {
  type: "order" | "cart" | "swap";
  order?: { id: string; display_id?: number };
}

export interface CompleteCartOutcome {
  /** The Medusa order ID, or null when completion did not produce an order. */
  orderId: string | null;
  /**
   * True when the failure looks transient (network error, 5xx, 429) and the
   * caller should ask Razorpay to redeliver. False for permanent conditions,
   * retrying those just burns the retry budget.
   */
  retryable: boolean;
}

/**
 * Turn a Medusa cart into a confirmed order.
 *
 * Call only after the payment has been cryptographically verified.
 */
export async function completeCart(cartId: string): Promise<CompleteCartOutcome> {
  // Medusa's own complete workflow does not reject an empty cart - it happily
  // produces a real order charging only shipping. A line item can silently
  // fail to be added (e.g. an out-of-stock race) while the rest of checkout
  // proceeds regardless, so this has to be checked here, not assumed upstream.
  const snapshot = await fetchCartSnapshot(cartId);
  if (!snapshot) {
    return { orderId: null, retryable: true };
  }
  if (snapshot.itemCount === 0) {
    console.error(`[medusa-order] refusing to complete empty cart ${cartId}`);
    return { orderId: null, retryable: false };
  }

  try {
    const res = await fetch(`${BASE_URL}/store/carts/${cartId}/complete`, {
      signal: AbortSignal.timeout(MEDUSA_TIMEOUT_MS),
      method: "POST",
      headers: storeHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[medusa-order] complete ${res.status} ${res.statusText}, cart ${cartId}`
      );
      // 409: another request (verify or a webhook) is completing this cart right now.
      return {
        orderId: null,
        retryable: res.status >= 500 || res.status === 429 || res.status === 409,
      };
    }

    const data = (await res.json()) as MedusaCompleteResponse;

    if (data.type === "order" && data.order?.id) {
      return { orderId: data.order.id, retryable: false };
    }

    // Medusa returned the cart instead of an order, usually a validation
    // failure (out of stock, no shipping method). Retrying will not fix it.
    console.error(
      `[medusa-order] complete returned type "${data.type}" instead of an order, cart ${cartId}`
    );
    return { orderId: null, retryable: false };
  } catch (err) {
    console.error("[medusa-order] complete error for cart", cartId, ":", err);
    return { orderId: null, retryable: true };
  }
}

/* ── Payment reconciliation metadata ─────────────────────────
 *
 * Without this, there is no durable link between a Medusa order and the
 * Razorpay payment that paid for it. The backend records the ids on the order
 * after checking them (the Razorpay order is this cart's, and Razorpay lists
 * the payment as paid), merges them into the order's metadata so nothing else
 * is lost, and accepts the same ids any number of times. It works on a cart
 * that was already completed, so verify and the webhook can both call it.
 */

const ADMIN_KEY = process.env.MEDUSA_ADMIN_API_KEY ?? "";

export type RazorpayConfirmation =
  | { ok: true; orderId: string }
  | { ok: false; retryable: boolean; status: number; message: string };

export async function confirmRazorpayPayment(
  cartId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<RazorpayConfirmation> {
  if (!ADMIN_KEY) {
    return { ok: false, retryable: false, status: 0, message: "MEDUSA_ADMIN_API_KEY is not set" };
  }
  try {
    const res = await fetch(`${BASE_URL}/admin/razorpay-confirmations`, {
      signal: AbortSignal.timeout(MEDUSA_TIMEOUT_MS),
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${ADMIN_KEY}` },
      body: JSON.stringify({
        cart_id: cartId,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
      }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { order_id?: unknown; message?: unknown };
    if (res.ok && typeof body.order_id === "string") {
      return { ok: true, orderId: body.order_id };
    }
    const message = typeof body.message === "string" ? body.message : `HTTP ${res.status}`;
    console.error(`[medusa-order] Razorpay confirmation ${res.status} for cart ${cartId}: ${message}`);
    // 404: no order yet; 5xx: backend or Razorpay down. Both can succeed later.
    return { ok: false, retryable: res.status >= 500 || res.status === 404 || res.status === 429, status: res.status, message };
  } catch (err) {
    console.error("[medusa-order] Razorpay confirmation error for cart", cartId, ":", err);
    return { ok: false, retryable: true, status: 0, message: "network error" };
  }
}

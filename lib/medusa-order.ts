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
      method: "POST",
      headers: storeHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[medusa-order] complete ${res.status} ${res.statusText}, cart ${cartId}`
      );
      return { orderId: null, retryable: res.status >= 500 || res.status === 429 };
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
 * Razorpay payment that paid for it, the only record is a Redis
 * idempotency key that expires after 30 days. Persisting it onto the
 * order itself is what makes reconciling against Razorpay's own records
 * possible at all, at any point in the future.
 */

const ADMIN_KEY = process.env.MEDUSA_ADMIN_API_KEY ?? "";

export async function persistRazorpayPaymentId(
  orderId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<void> {
  if (!ADMIN_KEY) return;
  try {
    await fetch(`${BASE_URL}/admin/orders/${orderId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ADMIN_KEY}`,
      },
      body: JSON.stringify({
        metadata: {
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
        },
      }),
      cache: "no-store",
    });
  } catch (err) {
    console.error(
      "[medusa-order] failed to persist Razorpay payment id for order",
      orderId,
      ":",
      err
    );
  }
}

/**
 * Server-only: durable bookkeeping for the Razorpay payment path.
 *
 * Two responsibilities:
 *
 *   1. razorpay_order_id → medusa_cart_id mapping, written server-side at
 *      order-creation time. The webhook needs this because Razorpay's callback
 *      carries no Medusa identifiers of its own, and anything the *browser*
 *      supplies (checkout `notes`) is attacker-controlled.
 *
 *   2. Payment-level idempotency. Razorpay retries webhooks on any non-2xx and
 *      can legitimately deliver both `payment.captured` and `order.paid` for a
 *      single payment, so the handler must be safe to run repeatedly.
 *
 * Every function degrades to a no-op when Upstash is not configured, the
 * webhook then falls back to Medusa's own `completed_at` check for idempotency.
 */
import "server-only";

import { redis } from "@/lib/redis";
import { claimPaymentIn, markProcessedIn, releaseIn, type PaymentClaim } from "@/lib/payment-claim";

/** Carts outlive a checkout session but not indefinitely. */
const CART_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const cartKey = (razorpayOrderId: string) => `eyra:rzp:cart:${razorpayOrderId}`;

/* ── Cart mapping ─────────────────────────────────────────── */

/**
 * Bind a Razorpay order to the Medusa cart it was created from.
 * Called from /api/razorpay/create-order, where both IDs are known and both
 * are server-derived.
 */
export async function rememberCartForRazorpayOrder(
  razorpayOrderId: string,
  cartId: string
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(cartKey(razorpayOrderId), cartId, { ex: CART_TTL_SECONDS });
  } catch (err) {
    // Non-fatal: checkout still works, but the webhook will have to fall back
    // to the (untrusted) notes path for this payment.
    console.error(
      "[razorpay-store] Failed to persist cart mapping for",
      razorpayOrderId,
      "webhook recovery for this order will be degraded:",
      err
    );
  }
}

/** Resolve the Medusa cart for a Razorpay order. Null when unknown. */
export async function lookupCartForRazorpayOrder(
  razorpayOrderId: string
): Promise<string | null> {
  if (!redis) return null;
  try {
    return await redis.get<string>(cartKey(razorpayOrderId));
  } catch (err) {
    console.error("[razorpay-store] Cart mapping lookup failed for", razorpayOrderId, ":", err);
    return null;
  }
}

/* ── Payment idempotency ──────────────────────────────────── */

// The logic lives in payment-claim.ts so it can be tested without Redis.
export type { PaymentClaim } from "@/lib/payment-claim";

const store = redis
  ? {
      set: (key: string, value: string, options: { nx?: boolean; ex: number }) =>
        options.nx
          ? redis!.set(key, value, { nx: true, ex: options.ex })
          : redis!.set(key, value, { ex: options.ex }),
      get: (key: string) => redis!.get<string>(key),
      del: (key: string) => redis!.del(key),
    }
  : null;

/**
 * Claim a payment for processing. The claim is temporary (a few minutes) until
 * markPaymentProcessed makes it permanent, so a delivery that dies part-way
 * never blocks Razorpay's redeliveries for long.
 */
export function claimPayment(paymentId: string): Promise<PaymentClaim> {
  return claimPaymentIn(store, paymentId);
}

/** Call once the order exists and its Razorpay ids and email are handled. */
export function markPaymentProcessed(paymentId: string): Promise<void> {
  return markProcessedIn(store, paymentId);
}

/** Release a temporary claim so a Razorpay retry (or manual replay) can try again. */
export function releasePayment(paymentId: string): Promise<void> {
  return releaseIn(store, paymentId);
}

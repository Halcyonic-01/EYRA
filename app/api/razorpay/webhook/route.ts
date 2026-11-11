/**
 * Razorpay webhook, the guaranteed confirmation path.
 *
 * /api/razorpay/verify only runs if the customer's browser survives long enough
 * to call it. When the modal is closed early, the tab dies, or the network drops
 * after capture, the money moves and no order is ever created. This endpoint
 * closes that gap: Razorpay delivers the event server-to-server and retries on
 * any non-2xx response.
 *
 * Configure in the Razorpay dashboard (Settings → Webhooks):
 *   URL     https://<your-domain>/api/razorpay/webhook
 *   Events  payment.captured, payment.failed, order.paid
 *   Secret  → RAZORPAY_WEBHOOK_SECRET (distinct from RAZORPAY_KEY_SECRET)
 *
 * NOTE: this handler completes the order only. Shiprocket shipment creation
 * still happens exclusively on the client path in CheckoutClient, so an order
 * recovered here will have no AWB until it is dispatched from Medusa admin.
 * Wiring dispatch in here needs a guard against duplicate shipments first.
 */
import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

import { completeCart, confirmRazorpayPayment, fetchCartSnapshot } from "@/lib/medusa-order";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import {
  claimPayment,
  lookupCartForRazorpayOrder,
  markPaymentProcessed,
  releasePayment,
} from "@/lib/razorpay-store";

// Signature verification needs node:crypto and the unbuffered request body.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Must stay below the payment claim's lifetime (PROCESSING_TTL_SECONDS in lib/payment-claim.ts).
export const maxDuration = 60;

/* ── Razorpay event shapes ────────────────────────────────── */

interface RazorpayPaymentEntity {
  id: string;
  order_id: string | null;
  /** Amount actually paid, in the smallest currency unit (paise). */
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string> | null;
  error_description?: string | null;
}

interface RazorpayOrderEntity {
  id: string;
  amount: number;
  notes?: Record<string, string> | null;
}

interface RazorpayWebhookEvent {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
    order?: { entity?: RazorpayOrderEntity };
  };
}

/** How the cart ID was resolved, determines how much we trust it. */
type CartSource = "mapping" | "notes";

/* ── Signature verification ───────────────────────────────── */

/**
 * Razorpay signs the raw request body with the webhook secret (HMAC-SHA256,
 * hex). The body must be hashed exactly as received, re-serialising parsed
 * JSON reorders keys and breaks the digest.
 */
function signatureValid(rawBody: string, received: string, secret: string): boolean {
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");

  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(received, "hex");

  // Buffer.from silently truncates malformed hex, so compare lengths first.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/* ── Route handler ────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[EYRA Security] RAZORPAY_WEBHOOK_SECRET is not configured, webhook events cannot be authenticated and are being rejected."
    );
    return Response.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const receivedSignature = request.headers.get("x-razorpay-signature");

  if (!receivedSignature) {
    console.error("[EYRA Security] Webhook request arrived with no x-razorpay-signature header.");
    return Response.json({ error: "Missing signature." }, { status: 400 });
  }

  if (!signatureValid(rawBody, receivedSignature, secret)) {
    console.error(
      "[EYRA Security] Webhook signature verification FAILED, request rejected. " +
      "This is either a misconfigured secret or a forged delivery."
    );
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookEvent;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const eventName = event.event ?? "unknown";
  const payment = event.payload?.payment?.entity;

  /* ── Events we don't act on ─────────────────────────────── */

  if (eventName === "payment.failed") {
    console.warn(
      "[razorpay/webhook] Payment failed:",
      `payment: ${payment?.id ?? "unknown"},`,
      `order: ${payment?.order_id ?? "unknown"},`,
      `reason: ${payment?.error_description ?? "not provided"}`
    );
    return Response.json({ received: true, acted: false });
  }

  if (eventName !== "payment.captured" && eventName !== "order.paid") {
    return Response.json({ received: true, acted: false, ignored: eventName });
  }

  if (!payment?.id) {
    console.error(`[razorpay/webhook] "${eventName}" carried no payment entity, cannot process.`);
    return Response.json({ received: true, acted: false, reason: "no_payment_entity" });
  }

  /* ── Idempotency ────────────────────────────────────────── */

  // Razorpay sends both payment.captured and order.paid for a single payment,
  // and redelivers on any non-2xx. Only one of those may complete the cart.
  // The claim is temporary while this delivery works and permanent only once the
  // order is confirmed, so a delivery that dies part-way never swallows a payment.
  const claim = await claimPayment(payment.id);
  if (claim === "already_processed") {
    return Response.json({ received: true, acted: false, deduped: true });
  }
  if (claim === "in_progress") {
    // Another delivery (payment.captured and order.paid arrive together) is on it.
    // Not 2xx, so Razorpay comes back later and finds it done.
    return Response.json({ error: "Already being processed." }, { status: 409 });
  }

  /* ── Resolve the Medusa cart ────────────────────────────── */

  // Preferred: the server-written mapping from /api/razorpay/create-order.
  // Fallback: checkout notes, which originate in the browser and are therefore
  // attacker-controlled, that path gets an extra amount check below.
  let cartId: string | null = payment.order_id
    ? await lookupCartForRazorpayOrder(payment.order_id)
    : null;
  let cartSource: CartSource = "mapping";

  if (!cartId) {
    cartId =
      payment.notes?.medusa_cart_id ??
      event.payload?.order?.entity?.notes?.medusa_cart_id ??
      null;
    cartSource = "notes";
  }

  if (!cartId) {
    console.error(
      "[EYRA Security] MANUAL RECONCILIATION REQUIRED, payment captured but no Medusa cart could be resolved. " +
      `payment: ${payment.id}, razorpay_order: ${payment.order_id ?? "none"}, ` +
      `amount: ₹${payment.amount / 100}.`
    );
    await releasePayment(payment.id);
    return Response.json({ received: true, acted: false, reason: "cart_unresolved" });
  }

  /* ── Pre-flight checks ──────────────────────────────────── */

  const snapshot = await fetchCartSnapshot(cartId);

  if (!snapshot) {
    // Unknown cart or unreachable backend, indistinguishable here, so let
    // Razorpay redeliver rather than dropping a captured payment.
    console.error(
      `[razorpay/webhook] Could not read cart ${cartId} for payment ${payment.id}, requesting redelivery.`
    );
    await releasePayment(payment.id);
    return Response.json({ error: "Cart unavailable." }, { status: 500 });
  }

  if (snapshot.completedAt) {
    // The client path (or Medusa's own webhook) already completed it. Still make
    // sure the Razorpay ids and the confirmation email are done: verify may have
    // stopped right after completing. Both steps are safe to repeat.
    return finalizeOrder(cartId, payment, eventName, "already_completed");
  }

  // Only enforced on the untrusted resolution path: without it, a spoofed
  // `notes.medusa_cart_id` could point a small payment at an expensive cart.
  // Razorpay reports payment.amount in paise; snapshot.total is in rupees.
  if (cartSource === "notes" && snapshot.total * 100 !== payment.amount) {
    console.error(
      "[EYRA Security] TRANSACTION BLOCKED, amount mismatch on notes-resolved cart. " +
      `payment: ${payment.id}, paid: ₹${payment.amount / 100}, cart ${cartId} owes: ₹${snapshot.total}. ` +
      "Cart was NOT completed."
    );
    await releasePayment(payment.id);
    return Response.json({ received: true, acted: false, reason: "amount_mismatch" });
  }

  /* ── Complete the order ─────────────────────────────────── */

  const { orderId, retryable } = await completeCart(cartId);

  if (!orderId) {
    // Release the claim either way so a redelivery or manual replay can retry
    // once the underlying problem (stock, shipping method, backend) is fixed.
    await releasePayment(payment.id);

    if (retryable) {
      return Response.json({ error: "Order completion failed." }, { status: 500 });
    }

    console.error(
      "[EYRA Security] MANUAL RECONCILIATION REQUIRED, payment captured but cart completion was rejected. " +
      `payment: ${payment.id}, cart: ${cartId}, amount: ₹${payment.amount / 100}.`
    );
    return Response.json({ received: true, acted: false, reason: "completion_rejected" });
  }

  console.info(
    `[razorpay/webhook] Completed via ${eventName}, medusa_order: ${orderId}, ` +
    `payment: ${payment.id}, cart resolved via ${cartSource}.`
  );
  return finalizeOrder(cartId, payment, eventName, "completed");
}

/**
 * After the cart is an order: record the Razorpay ids on it and send the
 * confirmation email, both once however often this runs. The payment claim
 * becomes permanent only when the ids are recorded; if the backend cannot be
 * reached, the claim is released and Razorpay is asked to come back.
 */
async function finalizeOrder(
  cartId: string,
  payment: RazorpayPaymentEntity,
  eventName: string,
  outcome: "completed" | "already_completed"
): Promise<Response> {
  if (!payment.order_id) {
    await markPaymentProcessed(payment.id);
    return Response.json({ received: true, acted: outcome === "completed" });
  }

  const confirmed = await confirmRazorpayPayment(cartId, payment.order_id, payment.id);
  if (!confirmed.ok) {
    if (confirmed.retryable) {
      await releasePayment(payment.id);
      return Response.json({ error: "Order confirmation failed." }, { status: 500 });
    }
    console.error(
      "[EYRA Security] MANUAL RECONCILIATION REQUIRED, the Razorpay ids could not be recorded on the order. " +
      `payment: ${payment.id}, cart: ${cartId}, reason: ${confirmed.message}.`
    );
    await markPaymentProcessed(payment.id);
    return Response.json({ received: true, acted: false, reason: "confirmation_rejected" });
  }

  const email = await sendOrderConfirmationEmail(confirmed.orderId);
  if (email === "failed") {
    // Not retried through Razorpay: a webhook that keeps failing gets switched
    // off, which would put every later payment at risk. The email gate stops a
    // later verify call or redelivery from sending a second copy.
    console.error(`[razorpay/webhook] confirmation email NOT sent for order ${confirmed.orderId} (${eventName}).`);
  }

  await markPaymentProcessed(payment.id);
  return Response.json({
    received: true,
    acted: outcome === "completed",
    alreadyCompleted: outcome === "already_completed",
    medusa_order_id: confirmed.orderId,
    email,
  });
}

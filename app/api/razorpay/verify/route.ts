import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

import { completeCart, confirmRazorpayPayment } from "@/lib/medusa-order";
import { lookupCartForRazorpayOrder } from "@/lib/razorpay-store";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import { applyRateLimit } from "@/lib/rateLimit";

interface VerifyBody {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  medusa_cart_id: string;
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, "razorpay_verify", 10);
  if (rateLimitResponse) return rateLimitResponse;

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    // Hard failure, operating without a secret means signatures can never be
    // verified, so no payment should be accepted.
    throw new Error("RAZORPAY_KEY_SECRET is not configured on this server.");
  }

  let body: Partial<VerifyBody>;
  try {
    body = (await request.json()) as Partial<VerifyBody>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, medusa_cart_id } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !medusa_cart_id) {
    return Response.json(
      { error: "Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature, medusa_cart_id." },
      { status: 400 }
    );
  }

  // Razorpay's signing scheme: HMAC-SHA256 of "order_id|payment_id"
  const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedHex = createHmac("sha256", secret).update(payload).digest("hex");

  // Timing-safe comparison prevents timing-oracle attacks on the HMAC check.
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(razorpay_signature, "hex");

  const signatureValid =
    expected.length === received.length &&
    timingSafeEqual(expected, received);

  if (!signatureValid) {
    return Response.json(
      { error: "Payment signature verification failed. Transaction rejected." },
      { status: 400 }
    );
  }

  // The signature only proves order_id and payment_id are a genuine,
  // linked Razorpay transaction, it says nothing about medusa_cart_id,
  // which rides along in the same request body and is fully
  // browser-controlled. Trusting it directly would let a customer pay for
  // a cheap cart, then resubmit verify with someone else's expensive
  // cart_id and get it marked paid for free.
  //
  // The only trustworthy source for "which cart does this Razorpay order
  // belong to" is the mapping /api/razorpay/create-order wrote server-side
  // before the client ever saw an order_id.
  const trustedCartId = await lookupCartForRazorpayOrder(razorpay_order_id);

  if (!trustedCartId) {
    // No server-side record of this order (Redis unavailable, or the
    // mapping expired), we cannot safely trust the client-supplied cart
    // ID, so this route must not complete anything. Report the payment as
    // verified (it is, the signature checked out) but leave completion to
    // /api/razorpay/webhook, which independently re-derives the cart and
    // amount-checks any untrusted resolution before completing it.
    return Response.json({
      verified: true,
      medusa_order_id: null,
      razorpay_payment_id,
      razorpay_order_id,
    });
  }

  if (trustedCartId !== medusa_cart_id) {
    console.error(
      "[EYRA Security] verify request's medusa_cart_id did not match the " +
      `trusted mapping for razorpay_order ${razorpay_order_id} ` +
      `(claimed: ${medusa_cart_id}, actual: ${trustedCartId}). Using the ` +
      "trusted cart ID; the claimed one was ignored."
    );
  }

  // Signature is valid and the cart is server-verified, convert it into a
  // confirmed order. Always use the trusted ID, never the client-supplied one.
  const { orderId: medusaOrderId } = await completeCart(trustedCartId);

  if (!medusaOrderId) {
    // Payment was real but order creation failed (e.g. Medusa backend down).
    // Return verified=true so the client can still reach the success page, but
    // flag the missing order ID so support can investigate if needed.
    // /api/razorpay/webhook is the recovery path: Razorpay will redeliver
    // payment.captured and the cart gets completed server-side.
    return Response.json({
      verified: true,
      medusa_order_id: null,
      razorpay_payment_id,
      razorpay_order_id,
    });
  }

  // Both are safe to repeat; the webhook does the same if this request dies here.
  const confirmed = await confirmRazorpayPayment(trustedCartId, razorpay_order_id, razorpay_payment_id);
  if (!confirmed.ok) {
    console.error(
      `[razorpay/verify] Razorpay ids not recorded for order ${medusaOrderId} (${confirmed.message}); ` +
      "the webhook will try again."
    );
  }
  await sendOrderConfirmationEmail(medusaOrderId);

  return Response.json({
    verified: true,
    medusa_order_id: medusaOrderId,
    razorpay_payment_id,
    razorpay_order_id,
  });
}

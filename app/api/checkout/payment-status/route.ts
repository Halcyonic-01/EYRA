import { NextRequest, NextResponse } from "next/server";

import { fetchPaymentStanding } from "@/lib/medusa-payment-standing";
import { applyRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/checkout/payment-status  { cartId }
 *
 * Where the cart's payment stands, straight from the backend, which asks the
 * payment providers. The cart id is what the browser already holds for its own
 * cart. 503 when the backend cannot answer: the checkout then pauses paying.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, "payment_status", 600);
  if (limited) return limited;

  const { cartId } = (await req.json().catch(() => ({}))) as { cartId?: unknown };
  if (typeof cartId !== "string" || !/^cart_[A-Za-z0-9]+$/.test(cartId)) {
    return NextResponse.json({ error: "cartId is required" }, { status: 400 });
  }
  const lookup = await fetchPaymentStanding(cartId);
  if (!lookup.ok) {
    const status = lookup.status === 404 ? 404 : 503;
    return NextResponse.json({ error: status === 404 ? "cart_not_found" : "unavailable" }, { status, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ payment: lookup.payment }, { headers: { "Cache-Control": "no-store" } });
}

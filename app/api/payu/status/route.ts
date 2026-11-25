import { NextRequest, NextResponse } from "next/server";

import { confirmPayuReturn, PAYU_RETURN_COOKIE } from "@/lib/medusa-payu";
import { decodeReturnCookie } from "@/lib/payu-cookie";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import { cancelledByCustomer, looksLikePayuReturn, type PayuStatusAnswer } from "@/lib/payu";
import { applyRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/payu/status
 *
 * Where the customer's last PayU payment stands, asked of the backend each time
 * from the fields PayU posted back (kept in a short-lived httpOnly cookie). The
 * backend re-checks the hash and PayU's own records, so this only ever reports
 * an order the backend has placed for this payment.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, "payu_status", 600);
  if (limited) return limited;

  const fields = decodeReturnCookie(req.cookies.get(PAYU_RETURN_COOKIE)?.value);
  const noStore = { headers: { "Cache-Control": "no-store" } };
  if (!fields || !looksLikePayuReturn(fields)) {
    const answer: PayuStatusAnswer = { status: "unverified", orderId: null, cartId: null, paymentId: null, cancelled: false };
    return NextResponse.json(answer, noStore);
  }

  const outcome = await confirmPayuReturn(fields);
  if (outcome.status === "order" && outcome.orderId) {
    await sendOrderConfirmationEmail(outcome.orderId);
  }
  const answer: PayuStatusAnswer = {
    status: outcome.status,
    orderId: outcome.orderId,
    cartId: outcome.cartId,
    paymentId: fields.mihpayid || null,
    cancelled: outcome.status === "failed" && cancelledByCustomer(fields),
  };
  return NextResponse.json(answer, noStore);
}

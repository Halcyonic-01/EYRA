import { NextRequest, NextResponse } from "next/server";

import { confirmPayuReturn, setReturnCookie } from "@/lib/medusa-payu";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import { looksLikePayuReturn, pickReturnFields } from "@/lib/payu";
import { applyRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/payu/return   (PayU's surl and furl)
 *
 * PayU sends the customer's browser here with a form post after the hosted
 * checkout, paid or not. The fields go to the backend, which checks PayU's hash,
 * asks PayU what happened and completes the cart if it was paid. The customer is
 * then sent to the status page, which asks again rather than trusting this
 * redirect, so nothing in the URL can mark a payment as paid.
 */

const STATUS_PAGE = "/payment-status/payu";

function toStatusPage(req: NextRequest): NextResponse {
  // 303: the browser follows with a GET, so a refresh never posts PayU's fields again.
  return NextResponse.redirect(new URL(STATUS_PAGE, req.url), 303);
}

export async function POST(req: NextRequest) {
  // Never a bare 429 here: the customer may have just paid. Over the limit, the
  // backend is not asked now and the status page asks instead.
  const limited = await applyRateLimit(req, "payu_return", 120);

  let posted: Record<string, unknown> = {};
  try {
    const form = await req.formData();
    posted = Object.fromEntries(form.entries());
  } catch {
    // Not a form post: the status page will say the payment could not be confirmed.
  }
  const fields = pickReturnFields(posted);
  const res = toStatusPage(req);
  if (!looksLikePayuReturn(fields)) return res;

  setReturnCookie(res, fields);
  if (limited) return res;
  const outcome = await confirmPayuReturn(fields);
  if (outcome.status === "order" && outcome.orderId) {
    // Safe to repeat: the email is sent once per order.
    await sendOrderConfirmationEmail(outcome.orderId);
  }
  return res;
}

/** Someone opening the address directly: nothing to confirm, show the status page. */
export function GET(req: NextRequest) {
  return toStatusPage(req);
}

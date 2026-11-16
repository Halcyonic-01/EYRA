import { NextRequest, NextResponse } from "next/server";

import { fetchOrderForReturn, quoteReturnRequest } from "@/lib/medusa-returns";
import { applyRateLimit } from "@/lib/rateLimit";
import { REQUEST_REASONS, type ReturnRequestReason } from "@/lib/return-requests";
import { getWalletCustomer } from "@/lib/wallet-customer";

const REASONS = REQUEST_REASONS.map((r) => r.value);

/**
 * What an exchange would cost: the backend's own figures, from the same checks a
 * real request goes through, so the amount shown is the amount the payment link
 * asks for. Nothing is saved.
 *
 * Body: { orderId, itemId, replacementVariantId, reason? }
 */
export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req, "return_quote", 40);
  if (rateLimitResponse) return rateLimitResponse;

  const customer = await getWalletCustomer();
  if (!customer) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  let body: { orderId?: unknown; itemId?: unknown; replacementVariantId?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { orderId, itemId, replacementVariantId, reason } = body;
  if (
    typeof orderId !== "string" || !orderId.startsWith("order_") ||
    typeof itemId !== "string" || !itemId.startsWith("ordli_") ||
    typeof replacementVariantId !== "string" || !replacementVariantId.startsWith("variant_")
  ) {
    return NextResponse.json({ error: "Choose the item and what you want instead." }, { status: 400 });
  }
  // The reason does not change an exchange's price; any valid one works until one is chosen.
  const chosenReason = REASONS.includes(reason as ReturnRequestReason) ? (reason as ReturnRequestReason) : "SIZE_ISSUE";

  const order = await fetchOrderForReturn(orderId);
  if (!order || order.customerId !== customer.customerId) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const result = await quoteReturnRequest({
    customerId: customer.customerId,
    orderId,
    type: "exchange",
    reason: chosenReason,
    replacementVariantId,
    items: [{ itemId, quantity: 1 }],
  });
  if (!result.ok) return NextResponse.json({ error: "rejected", message: result.message }, { status: 409 });
  return NextResponse.json({ quote: result.quote });
}

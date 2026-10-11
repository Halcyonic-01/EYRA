import { NextRequest, NextResponse } from "next/server";

import { parseCancelRequest, statusForCancelCode } from "@/lib/cancellation";
import { cancelOrder, fetchCancellationPreview } from "@/lib/medusa-cancellation";
import { applyRateLimit } from "@/lib/rateLimit";
import { getWalletCustomer } from "@/lib/wallet-customer";

interface Context {
  params: Promise<{ id: string }>;
}

/** What the signed-in customer can do with one of their orders. */
export async function GET(_req: NextRequest, { params }: Context) {
  const customer = await getWalletCustomer();
  if (!customer) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  const { id } = await params;
  if (!id.startsWith("order_")) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  // The backend answers only for the customer's own orders.
  const preview = await fetchCancellationPreview(id, customer.customerId);
  if (!preview) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  return NextResponse.json({ preview });
}

/**
 * Cancel one of the signed-in customer's orders.
 *
 * Body: { reason, refundMethod?, note? }. Amounts are never taken from the
 * browser: the backend works out exactly what is refunded.
 */
export async function POST(req: NextRequest, { params }: Context) {
  const rateLimitResponse = await applyRateLimit(req, "order_cancel", 10);
  if (rateLimitResponse) return rateLimitResponse;

  const customer = await getWalletCustomer();
  if (!customer) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  const { id } = await params;
  if (!id.startsWith("order_")) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });
  }
  const parsed = parseCancelRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_request", message: parsed.message }, { status: 400 });
  }

  const result = await cancelOrder(id, customer.customerId, parsed.value);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: statusForCancelCode(result.code) }
    );
  }

  return NextResponse.json({ cancellation: result.cancellation, eta: result.eta });
}

import { NextRequest, NextResponse } from "next/server";

import { storeConfig } from "@/config/storeConfig";
import { createReturnRequest, fetchOrderForReturn, listReturnRequests } from "@/lib/medusa-returns";
import { applyRateLimit } from "@/lib/rateLimit";
import {
  eligibility,
  REQUEST_REASONS,
  reasonLabel,
  type ReturnRequestReason,
  type ReturnRequestType,
} from "@/lib/return-requests";
import { getWalletCustomer } from "@/lib/wallet-customer";
import { sendReturnRequestAlertEmail } from "@/lib/wallet-email";

const TYPES: ReturnRequestType[] = ["return", "exchange"];
const REASONS = REQUEST_REASONS.map((r) => r.value);

interface Body {
  orderId?: unknown;
  type?: unknown;
  reason?: unknown;
  note?: unknown;
  items?: unknown;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** The signed-in customer's requests for one order. */
export async function GET(req: NextRequest) {
  const customer = await getWalletCustomer();
  if (!customer) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  const orderId = req.nextUrl.searchParams.get("orderId") ?? undefined;
  const requests = await listReturnRequests(customer.customerId, orderId);
  if (!requests) return NextResponse.json({ error: "unavailable" }, { status: 502 });

  return NextResponse.json({ requests });
}

/**
 * Ask to return or exchange items from one of the customer's own orders.
 *
 * Body: { orderId, type, reason, note?, items: [{ itemId, quantity }] }
 */
export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req, "return_request", 8);
  if (rateLimitResponse) return rateLimitResponse;

  const customer = await getWalletCustomer();
  if (!customer) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { orderId, type, reason, note, items } = body;
  if (typeof orderId !== "string" || !orderId.startsWith("order_")) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }
  if (!TYPES.includes(type as ReturnRequestType)) {
    return NextResponse.json({ error: "Choose return or exchange." }, { status: 400 });
  }
  if (!REASONS.includes(reason as ReturnRequestReason)) {
    return NextResponse.json({ error: "Choose a reason." }, { status: 400 });
  }
  if (note !== undefined && (typeof note !== "string" || note.length > 1000)) {
    return NextResponse.json({ error: "Your note is too long." }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return NextResponse.json({ error: "Choose at least one item." }, { status: 400 });
  }
  const cleanItems: { itemId: string; quantity: number }[] = [];
  for (const entry of items as { itemId?: unknown; quantity?: unknown }[]) {
    if (
      typeof entry?.itemId !== "string" ||
      !entry.itemId.startsWith("ordli_") ||
      typeof entry.quantity !== "number" ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1
    ) {
      return NextResponse.json({ error: "Each item needs a whole quantity." }, { status: 400 });
    }
    cleanItems.push({ itemId: entry.itemId, quantity: entry.quantity });
  }

  // The order must be the signed-in customer's own. The admin API would happily
  // return anyone's order, so this is the check that matters.
  const order = await fetchOrderForReturn(orderId);
  if (!order || order.customerId !== customer.customerId) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const e = eligibility(order, storeConfig.policy);
  const kind = type as ReturnRequestType;
  if (kind === "return" ? !e.canReturn : !e.canExchange) {
    const message =
      e.closedReason === "cancelled"
        ? "This order was cancelled, so it cannot be returned."
        : e.closedReason === "not_delivered"
        ? "You can ask for a return or exchange once your order has been delivered."
        : `The ${kind} window for this order closed on ${formatDay((kind === "return" ? e.returnUntil : e.exchangeUntil) ?? new Date().toISOString())}.`;
    return NextResponse.json({ error: "not_eligible", message }, { status: 409 });
  }

  const result = await createReturnRequest({
    customerId: customer.customerId,
    orderId,
    type: kind,
    reason: reason as ReturnRequestReason,
    note: typeof note === "string" && note.trim() ? note.trim() : undefined,
    items: cleanItems,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "rejected", message: result.message }, { status: 409 });
  }

  // Our team finds out right away. A failed alert must not fail the request:
  // it is already saved and waiting in the admin.
  try {
    await sendReturnRequestAlertEmail({
      customerName: customer.name,
      customerEmail: customer.email,
      orderNumber: order.displayId,
      type: kind,
      reason: reasonLabel(result.request.reason),
      note: result.request.note,
      items: result.request.items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        total: item.total,
      })),
      itemsTotal: result.request.itemsTotal,
      deliveryUnconfirmed: e.deliveryUnconfirmed,
    });
  } catch (err) {
    console.error("[returns] alert email failed for request", result.request.id, ":", err);
  }

  return NextResponse.json({ request: result.request }, { status: 201 });
}

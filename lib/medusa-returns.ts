/**
 * Server-only: return and exchange requests.
 *
 * Like the wallet, these live in Medusa, and customers sign in with Clerk, so
 * the browser never talks to Medusa directly: our routes work out who the
 * signed-in customer is and call Medusa's admin API with the server key.
 */
import "server-only";

import type {
  ReturnRequestReason,
  ReturnRequestStatus,
  ReturnRequestType,
} from "@/lib/return-requests";

const BASE_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

const ADMIN_KEY = process.env.MEDUSA_ADMIN_API_KEY ?? "";

/* ── Types ────────────────────────────────────────────────── */

export interface ReturnRequestItem {
  itemId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  type: ReturnRequestType;
  reason: ReturnRequestReason;
  note: string | null;
  items: ReturnRequestItem[];
  itemsTotal: number;
  status: ReturnRequestStatus;
  /** Wallet credit issued, when approved. */
  creditAmount: number | null;
  /** Our team's message to the customer. */
  resolutionNote: string | null;
  createdAt: string;
  /** What was paid for the items, GST included, after any discount. */
  paidValue: number | null;
  /** The flat reverse logistics fee kept from a return's store credit. */
  feeAmount: number | null;
  /** The courier booked to collect the item, once there is one. */
  reverseAwb: string | null;
  /** An exchange: what is wanted instead, what to pay, and where. */
  exchange: {
    replacementTitle: string | null;
    replacementPrice: number | null;
    priceDifference: number | null;
    amountDue: number | null;
    feeLinkUrl: string | null;
    feePaid: boolean;
    /** The difference was paid but the exchange did not go ahead, so it was refunded. */
    feeRefunded: boolean;
    replacementOrderId: string | null;
  } | null;
  creditNoteId: string | null;
}

export interface OrderForReturn {
  id: string;
  displayId: number;
  customerId: string | null;
  email: string | null;
  status: string;
  items: { id: string; title: string; quantity: number; unitPrice: number; thumbnail: string | null }[];
  metadata: Record<string, unknown> | null;
}

interface RawRequest {
  id: string;
  order_id: string;
  type: ReturnRequestType;
  reason: ReturnRequestReason;
  note: string | null;
  items: { item_id: string; title: string; quantity: number; unit_price: number; total: number }[];
  items_total: number;
  status: ReturnRequestStatus;
  credit_amount: number | null;
  resolution_note: string | null;
  created_at: string;
  paid_value?: number | null;
  fee_amount?: number | null;
  reverse?: { awb?: string | null } | null;
  exchange?: {
    replacement_title: string | null;
    replacement_price: number | null;
    price_difference: number | null;
    amount_due: number | null;
    fee_link_url: string | null;
    fee_paid_at: string | null;
    fee_refunded_at?: string | null;
    replacement_order_id: string | null;
  } | null;
  credit_note_id?: string | null;
}

function toRequest(raw: RawRequest): ReturnRequest {
  return {
    id: raw.id,
    orderId: raw.order_id,
    type: raw.type,
    reason: raw.reason,
    note: raw.note,
    items: raw.items.map((item) => ({
      itemId: item.item_id,
      title: item.title,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      total: item.total,
    })),
    itemsTotal: raw.items_total,
    status: raw.status,
    creditAmount: raw.credit_amount,
    resolutionNote: raw.resolution_note,
    createdAt: raw.created_at,
    paidValue: raw.paid_value ?? null,
    feeAmount: raw.fee_amount ?? null,
    reverseAwb: raw.reverse?.awb ?? null,
    exchange: raw.exchange
      ? {
          replacementTitle: raw.exchange.replacement_title,
          replacementPrice: raw.exchange.replacement_price,
          priceDifference: raw.exchange.price_difference,
          amountDue: raw.exchange.amount_due,
          feeLinkUrl: raw.exchange.fee_link_url,
          feePaid: Boolean(raw.exchange.fee_paid_at),
          feeRefunded: Boolean(raw.exchange.fee_refunded_at),
          replacementOrderId: raw.exchange.replacement_order_id,
        }
      : null,
    creditNoteId: raw.credit_note_id ?? null,
  };
}

async function adminFetch(
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: Record<string, unknown> | null } | null> {
  if (!ADMIN_KEY) {
    console.warn("[medusa-returns] MEDUSA_ADMIN_API_KEY is not set, requests are unavailable");
    return null;
  }
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ADMIN_KEY}`,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    let body: Record<string, unknown> | null = null;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch (err) {
    console.error("[medusa-returns] fetch error for", path, ":", err);
    return null;
  }
}

/* ── Reads ────────────────────────────────────────────────── */

/** An order, with what the request form and eligibility check need. */
export async function fetchOrderForReturn(orderId: string): Promise<OrderForReturn | null> {
  const res = await adminFetch(
    `/admin/orders/${encodeURIComponent(orderId)}?fields=%2Bcustomer_id,%2Bmetadata,*items`
  );
  if (!res || res.status !== 200 || !res.body?.order) return null;

  const order = res.body.order as {
    id: string;
    display_id: number;
    customer_id: string | null;
    email: string | null;
    status: string;
    metadata: Record<string, unknown> | null;
    items?: { id: string; title: string; quantity: number; unit_price: number; thumbnail: string | null }[];
  };

  return {
    id: order.id,
    displayId: order.display_id,
    customerId: order.customer_id,
    email: order.email,
    status: order.status,
    metadata: order.metadata,
    items: (order.items ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      thumbnail: item.thumbnail,
    })),
  };
}

/** A customer's requests, newest first, optionally for one order. Null if unreadable. */
export async function listReturnRequests(
  customerId: string,
  orderId?: string
): Promise<ReturnRequest[] | null> {
  const params = new URLSearchParams({ customer_id: customerId, limit: "50" });
  if (orderId) params.set("order_id", orderId);

  const res = await adminFetch(`/admin/return-requests?${params.toString()}`);
  if (!res || res.status !== 200 || !res.body) return null;

  return (res.body.return_requests as RawRequest[]).map(toRequest);
}

/* ── Create ───────────────────────────────────────────────── */

export interface CreateReturnRequestInput {
  customerId: string;
  orderId: string;
  type: ReturnRequestType;
  reason: ReturnRequestReason;
  note?: string;
  /** An exchange: the variant wanted instead. */
  replacementVariantId?: string;
  items: { itemId: string; quantity: number }[];
}

export type CreateReturnRequestResult =
  | { ok: true; request: ReturnRequest }
  | { ok: false; message: string };

export async function createReturnRequest(
  input: CreateReturnRequestInput
): Promise<CreateReturnRequestResult> {
  const res = await adminFetch("/admin/return-requests", {
    method: "POST",
    body: JSON.stringify({
      customer_id: input.customerId,
      order_id: input.orderId,
      type: input.type,
      reason: input.reason,
      ...(input.note ? { note: input.note } : {}),
      ...(input.replacementVariantId ? { replacement_variant_id: input.replacementVariantId } : {}),
      items: input.items.map((item) => ({ item_id: item.itemId, quantity: item.quantity })),
    }),
  });

  if (!res) return { ok: false, message: "We could not reach our systems. Please try again." };
  if (res.status !== 201 || !res.body?.return_request) {
    const message = typeof res.body?.message === "string" ? (res.body.message as string) : "";
    // Rules the customer can act on (already requested, too many) come back as
    // 4xx with a readable message; anything else is our problem, not theirs.
    if (res.status >= 400 && res.status < 500 && message) return { ok: false, message };
    console.error(`[medusa-returns] create failed ${res.status}:`, res.body);
    return { ok: false, message: "We could not send your request. Please try again." };
  }

  const request = res.body.return_request as { id: string };
  // The create endpoint returns the raw row; read it back in the usual shape.
  const list = await listReturnRequests(input.customerId, input.orderId);
  const created = list?.find((r) => r.id === request.id);
  if (!created) return { ok: false, message: "Your request was saved, but we could not show it. Please refresh." };
  return { ok: true, request: created };
}

/* ── Exchange payment ─────────────────────────────────────── */

export interface ReturnRequestQuote {
  type: ReturnRequestType;
  paidValue: number;
  replacementTitle: string | null;
  replacementPrice: number | null;
  priceDifference: number | null;
  /** What the customer pays before the pickup: 0 when nothing is owed. */
  amountDue: number;
  /** Store credit when it is done. */
  credit: number;
}

export type QuoteResult = { ok: true; quote: ReturnRequestQuote } | { ok: false; message: string };

/**
 * What a request would cost or give back, worked out by the backend with the same
 * checks and figures a real request uses. Nothing is saved.
 */
export async function quoteReturnRequest(input: CreateReturnRequestInput): Promise<QuoteResult> {
  const res = await adminFetch("/admin/return-requests/quote", {
    method: "POST",
    body: JSON.stringify({
      customer_id: input.customerId,
      order_id: input.orderId,
      type: input.type,
      reason: input.reason,
      ...(input.replacementVariantId ? { replacement_variant_id: input.replacementVariantId } : {}),
      items: input.items.map((item) => ({ item_id: item.itemId, quantity: item.quantity })),
    }),
  });
  if (!res) return { ok: false, message: "We could not reach our systems. Please try again." };
  const raw = res.body?.quote as
    | { type: ReturnRequestType; paid_value: number; replacement_title: string | null; replacement_price: number | null; price_difference: number | null; amount_due: number; credit: number }
    | undefined;
  if (res.status !== 200 || !raw) {
    const message = typeof res.body?.message === "string" ? (res.body.message as string) : "";
    if (res.status >= 400 && res.status < 500 && message) return { ok: false, message };
    return { ok: false, message: "We could not work out the price just now." };
  }
  return {
    ok: true,
    quote: {
      type: raw.type,
      paidValue: Number(raw.paid_value),
      replacementTitle: raw.replacement_title,
      replacementPrice: raw.replacement_price === null ? null : Number(raw.replacement_price),
      priceDifference: raw.price_difference === null ? null : Number(raw.price_difference),
      amountDue: Number(raw.amount_due),
      credit: Number(raw.credit),
    },
  };
}

/**
 * Asks the backend to check an exchange's payment with Razorpay now, so the
 * order page is right as soon as the customer comes back from paying. Returns
 * false when the check could not be made; the webhook and a backend job still
 * catch the payment later.
 */
export async function syncExchangePayment(requestId: string): Promise<boolean> {
  const res = await adminFetch(`/admin/return-requests/${encodeURIComponent(requestId)}/payment-status`, {
    method: "POST",
    body: "{}",
  });
  return Boolean(res && res.status === 200);
}

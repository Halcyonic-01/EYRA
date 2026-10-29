import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

import { isOwnSiteUrl } from "@/lib/email-layout";
import {
  sendOrderDeliveredEmail,
  sendOrderShippedEmail,
  sendPromotionEmail,
  sendRefundProcessedEmail,
  sendWelcomeOfferEmail,
} from "@/lib/customer-email";
import { sendOrderCancelledEmail, sendRequestRejectedEmail, sendWalletCreditEmail } from "@/lib/wallet-email";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

interface NotifyBody {
  type?: string;
  email?: string;
  first_name?: string | null;
  // credit_added
  kind?: "issued" | "refunded";
  amount?: number;
  balance?: number;
  expires_at?: string | null;
  reason?: string;
  note?: string | null;
  // request_rejected
  request_type?: "return" | "exchange";
  order_number?: number | null;
  // order_cancelled
  method?: "wallet" | "original" | "none";
  paid_online?: number;
  wallet_used?: number;
  fee?: number;
  refund_amount?: number;
  refund_status?: "not_needed" | "initiated" | "credited" | "failed" | "unverified";
  eta?: string;
  wallet_expires_at?: string | null;
  valid_months?: number;
  // order_shipped, order_delivered, refund_processed
  order_id?: string;
  awb?: string | null;
  courier?: string | null;
  credit_note?: string | null;
  // welcome_offer, promotion
  code?: string;
  min_order?: number | null;
  subject?: string;
  headline?: string;
  message?: string;
  cta_label?: string;
  cta_url?: string;
  /** Set by the backend on updates that must go out once; passed on to Resend. */
  idempotency_key?: string;
}

/**
 * Called by the Medusa backend when the wallet or a return request needs the
 * customer told. It sends the email; it does not decide whether to.
 *
 * Authenticated with the secret the backend already shares with the storefront
 * for product revalidation (STOREFRONT_REVALIDATE_SECRET).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ error: "Notifications are not configured." }, { status: 503 });
  }

  const received = req.headers.get("x-revalidate-secret");
  if (!received || !safeEqual(received, secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: NotifyBody;
  try {
    body = (await req.json()) as NotifyBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }

  if (body.type === "credit_added") {
    if (
      (body.kind !== "issued" && body.kind !== "refunded") ||
      typeof body.amount !== "number" ||
      typeof body.balance !== "number"
    ) {
      return Response.json({ error: "kind, amount and balance are required." }, { status: 400 });
    }
    const sent = await sendWalletCreditEmail({
      email: body.email,
      firstName: body.first_name,
      kind: body.kind,
      amount: body.amount,
      balance: body.balance,
      expiresAt: body.expires_at ?? null,
      reason: body.reason ?? "return",
      note: body.note ?? null,
    });
    return Response.json({ sent });
  }

  if (body.type === "request_rejected") {
    if ((body.request_type !== "return" && body.request_type !== "exchange") || !body.note) {
      return Response.json({ error: "request_type and note are required." }, { status: 400 });
    }
    const sent = await sendRequestRejectedEmail({
      email: body.email,
      firstName: body.first_name,
      requestType: body.request_type,
      orderNumber: body.order_number ?? null,
      note: body.note,
    });
    return Response.json({ sent });
  }

  if (body.type === "order_cancelled") {
    if (
      typeof body.order_number !== "number" ||
      (body.method !== "wallet" && body.method !== "original" && body.method !== "none") ||
      typeof body.refund_amount !== "number"
    ) {
      return Response.json({ error: "order_number, method and refund_amount are required." }, { status: 400 });
    }
    const sent = await sendOrderCancelledEmail({
      email: body.email,
      firstName: body.first_name,
      orderNumber: body.order_number,
      method: body.method,
      paidOnline: body.paid_online ?? 0,
      walletUsed: body.wallet_used ?? 0,
      fee: body.fee ?? 0,
      refundAmount: body.refund_amount,
      refundStatus: body.refund_status ?? "not_needed",
      eta: body.eta ?? "5 to 7 working days",
      walletExpiresAt: body.wallet_expires_at ?? null,
      validMonths: body.valid_months ?? 6,
    });
    return Response.json({ sent });
  }

  if (body.type === "order_shipped" || body.type === "order_delivered") {
    if (typeof body.order_number !== "number" || !body.order_id) {
      return Response.json({ error: "order_number and order_id are required." }, { status: 400 });
    }
    const common = {
      email: body.email,
      firstName: body.first_name,
      orderNumber: body.order_number,
      orderId: body.order_id,
      idempotencyKey: body.idempotency_key,
    };
    const sent =
      body.type === "order_shipped"
        ? await sendOrderShippedEmail({ ...common, awb: body.awb ?? null, courier: body.courier ?? null })
        : await sendOrderDeliveredEmail(common);
    return Response.json({ sent });
  }

  if (body.type === "refund_processed") {
    if (typeof body.order_number !== "number" || typeof body.refund_amount !== "number" || !body.reason) {
      return Response.json({ error: "order_number, refund_amount and reason are required." }, { status: 400 });
    }
    const sent = await sendRefundProcessedEmail({
      email: body.email,
      firstName: body.first_name,
      orderNumber: body.order_number,
      amount: body.refund_amount,
      reason: body.reason,
      creditNote: body.credit_note ?? null,
      eta: body.eta ?? "5 to 7 working days",
      idempotencyKey: body.idempotency_key,
    });
    return Response.json({ sent });
  }

  if (body.type === "welcome_offer") {
    if (!body.code || typeof body.amount !== "number" || typeof body.min_order !== "number") {
      return Response.json({ error: "code, amount and min_order are required." }, { status: 400 });
    }
    const sent = await sendWelcomeOfferEmail({
      email: body.email,
      firstName: body.first_name,
      code: body.code,
      amount: body.amount,
      minOrder: body.min_order,
      idempotencyKey: body.idempotency_key,
    });
    return Response.json({ sent });
  }

  if (body.type === "promotion") {
    if (!body.subject || !body.headline || !body.message || !body.cta_label || !body.cta_url) {
      return Response.json(
        { error: "subject, headline, message, cta_label and cta_url are required." },
        { status: 400 }
      );
    }
    if (!isOwnSiteUrl(body.cta_url)) {
      return Response.json({ error: "cta_url must be a page on the EYRA site." }, { status: 400 });
    }
    const hasOffer = !!body.code && typeof body.amount === "number";
    const sent = await sendPromotionEmail({
      email: body.email,
      firstName: body.first_name,
      subject: body.subject,
      headline: body.headline,
      message: body.message,
      offer: hasOffer
        ? { code: body.code as string, amount: body.amount as number, minOrder: body.min_order ?? null }
        : null,
      ctaLabel: body.cta_label,
      ctaUrl: body.cta_url,
      idempotencyKey: body.idempotency_key,
    });
    return Response.json({ sent });
  }

  return Response.json({ error: "Unknown notification type." }, { status: 400 });
}

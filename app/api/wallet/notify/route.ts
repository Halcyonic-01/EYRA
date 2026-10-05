import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

import { sendRequestRejectedEmail, sendWalletCreditEmail } from "@/lib/wallet-email";

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

  return Response.json({ error: "Unknown notification type." }, { status: 400 });
}

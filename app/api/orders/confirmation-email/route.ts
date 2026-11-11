import type { NextRequest } from "next/server";

import { checkInternalRequest } from "@/lib/internal-auth";
import { sendOrderConfirmationEmail } from "@/lib/order-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Backend only (shared secret): send an order's confirmation email if it has
 * not gone out yet. The backend's recovery job calls this for orders whose
 * email failed or was never attempted; the backend's once-only email claim
 * makes repeats and races harmless.
 *
 * Answers 200 with { result } for sent / already_sent / skipped, and 502 with
 * { result } for failed or busy, so the caller knows to try again later.
 */
export async function POST(req: NextRequest) {
  const auth = checkInternalRequest(req);
  if (auth === "unconfigured") return Response.json({ error: "Not configured." }, { status: 503 });
  if (auth === "unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });

  let orderId: unknown;
  try {
    orderId = ((await req.json()) as { order_id?: unknown }).order_id;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof orderId !== "string" || !/^order_[A-Za-z0-9]+$/.test(orderId)) {
    return Response.json({ error: "order_id is required." }, { status: 400 });
  }

  const result = await sendOrderConfirmationEmail(orderId);
  const done = result === "sent" || result === "already_sent" || result === "skipped";
  return Response.json({ result }, { status: done ? 200 : 502 });
}

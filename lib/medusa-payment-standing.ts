/**
 * Server-only: the backend's account of where a cart's payment stands.
 */
import "server-only";

import type { PaymentStanding } from "@/lib/payment-standing";

const BASE_URL = (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000").replace(/\/$/, "");
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

export type StandingLookup =
  | { ok: true; payment: PaymentStanding }
  | { ok: false; status: number };

/** Never throws. Status 0 when the backend could not be reached. */
export async function fetchPaymentStanding(cartId: string): Promise<StandingLookup> {
  try {
    const res = await fetch(`${BASE_URL}/store/carts/${encodeURIComponent(cartId)}/payment-status`, {
      headers: PUB_KEY ? { "x-publishable-api-key": PUB_KEY } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const body = (await res.json()) as { payment?: PaymentStanding };
    return body.payment ? { ok: true, payment: body.payment } : { ok: false, status: 502 };
  } catch (err) {
    console.error("[medusa-payment-standing]", cartId, err);
    return { ok: false, status: 0 };
  }
}

/** For routes that place an order with no online payment (COD, wallet only): the refusal to send, or null to go ahead. */
export async function onlinePaymentBlocker(cartId: string): Promise<{ error: string; message: string } | null> {
  const lookup = await fetchPaymentStanding(cartId);
  if (!lookup.ok) {
    return {
      error: "payment_status_unavailable",
      message: "We couldn't check for an earlier payment on this cart. Please try again in a minute.",
    };
  }
  const { payment } = lookup;
  if (payment.state === "none" && payment.can_pay) return null;
  const gateway = payment.provider_name ?? "your payment provider";
  const message =
    payment.state === "ordered"
      ? "This cart has already been ordered."
      : payment.state === "paid"
      ? `${gateway} already has your payment for this cart and your order is being confirmed. Please don't place it again.`
      : payment.state === "pending"
      ? `Your ${gateway} payment is still being confirmed. Please wait for it before choosing another way to pay.`
      : "We couldn't check for an earlier payment on this cart. Please try again in a minute.";
  return { error: "payment_in_progress", message };
}

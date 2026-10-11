/**
 * Server-only: asks the Medusa backend what a customer can cancel and carries
 * the cancellation out. The backend owns every rule (the cancel window, the
 * fee, the amounts); this only passes the signed-in customer's request along
 * with the server key.
 */
import "server-only";

import type { CancelRequest, CancellationPreview } from "@/lib/cancellation";

const BASE_URL = (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000").replace(/\/$/, "");
const ADMIN_KEY = process.env.MEDUSA_ADMIN_API_KEY ?? "";

export interface CancelOutcome {
  cancellation_id: string;
  order_id: string;
  refund_method: "wallet" | "original" | "none";
  paid_online: number;
  wallet_used: number;
  fee: number;
  refund_amount: number;
  refund_status: "not_needed" | "initiated" | "credited" | "failed" | "unverified";
  status: "completed" | "needs_attention";
  wallet_expires_at: string | null;
}

export type CancelResult =
  | { ok: true; cancellation: CancelOutcome; eta: string }
  | { ok: false; code: string; message: string };

async function adminFetch(path: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> | null } | null> {
  if (!ADMIN_KEY) {
    console.warn("[medusa-cancellation] MEDUSA_ADMIN_API_KEY is not set");
    return null;
  }
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        // Secret API keys (sk_...) authenticate via HTTP Basic.
        Authorization: `Basic ${ADMIN_KEY}`,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
  } catch (err) {
    console.error("[medusa-cancellation] fetch error for", path, ":", err);
    return null;
  }
}

/** What this customer can do with this order. Null if it is not theirs or cannot be read. */
export async function fetchCancellationPreview(
  orderId: string,
  customerId: string
): Promise<CancellationPreview | null> {
  const res = await adminFetch(
    `/admin/orders/${encodeURIComponent(orderId)}/cancellation?customer_id=${encodeURIComponent(customerId)}`
  );
  if (!res || res.status !== 200 || !res.body?.preview) return null;
  return res.body.preview as CancellationPreview;
}

export async function cancelOrder(
  orderId: string,
  customerId: string,
  request: CancelRequest
): Promise<CancelResult> {
  const res = await adminFetch(`/admin/orders/${encodeURIComponent(orderId)}/cancellation`, {
    method: "POST",
    body: JSON.stringify({
      customer_id: customerId,
      reason: request.reason,
      ...(request.refundMethod ? { refund_method: request.refundMethod } : {}),
      ...(request.note ? { note: request.note } : {}),
    }),
  });

  if (!res) {
    return { ok: false, code: "unavailable", message: "We could not reach our systems. Please try again." };
  }

  if (res.status === 200 && res.body?.cancellation) {
    return {
      ok: true,
      cancellation: res.body.cancellation as CancelOutcome,
      eta: typeof res.body.eta === "string" ? res.body.eta : "5 to 7 working days",
    };
  }

  const code = typeof res.body?.code === "string" ? res.body.code : "unknown";
  const message =
    typeof res.body?.message === "string" && res.status < 500
      ? res.body.message
      : typeof res.body?.message === "string" && ["refund_failed", "cancel_failed", "refund_unconfirmed", "cancel_incomplete"].includes(code)
      ? res.body.message
      : "Something went wrong. Please try again, or contact support.";
  return { ok: false, code, message };
}

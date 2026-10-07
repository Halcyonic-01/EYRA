/**
 * Shared (server and browser) types and labels for cancelling an order.
 * The rules themselves, what can be cancelled and what is refunded, live in the
 * backend; the storefront only shows what the backend says.
 */

export type CancelReason =
  | "changed_mind"
  | "ordered_by_mistake"
  | "found_better_price"
  | "delivery_time"
  | "address_or_details"
  | "other";

export const CANCEL_REASONS: { value: CancelReason; label: string }[] = [
  { value: "changed_mind", label: "I changed my mind" },
  { value: "ordered_by_mistake", label: "I ordered by mistake" },
  { value: "found_better_price", label: "I found a better price" },
  { value: "delivery_time", label: "Delivery will take too long" },
  { value: "address_or_details", label: "I entered the wrong address or details" },
  { value: "other", label: "Something else" },
];

export function cancelReasonLabel(value: string | null | undefined): string {
  return CANCEL_REASONS.find((r) => r.value === value)?.label ?? (value || "Not given");
}

export type RefundMethod = "wallet" | "original";

export type RefundStatus = "not_needed" | "pending" | "initiated" | "credited" | "failed" | "unverified";

export type BlockCode =
  | "not_your_order"
  | "already_cancelled"
  | "shipment_created"
  | "preparing"
  | "not_trackable"
  | "payment_not_settled";

export interface CancellationSummary {
  requested_by: "customer" | "staff";
  reason: string | null;
  refund_method: "wallet" | "original" | "none";
  paid_online: number;
  wallet_used: number;
  fee: number;
  refund_amount: number;
  status: "processing" | "completed" | "needs_attention";
  refund_status: RefundStatus;
  refund_error: string | null;
  razorpay_refund_id: string | null;
  wallet_expires_at: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CancellationPreview {
  order_id: string;
  display_id: number;
  can_cancel: boolean;
  code: BlockCode | null;
  message: string | null;
  dispatch_state: string | null;
  window_ends_at: string | null;
  payment_kind: "online" | "online_and_wallet" | "wallet_only" | "cod" | "cod_and_wallet";
  total: number;
  paid_online: number;
  wallet_used: number;
  fee: number;
  requires_choice: boolean;
  options: {
    wallet: { amount: number; available: boolean } | null;
    original: { amount: number; fee: number; available: boolean; unavailable_reason?: string } | null;
  };
  eta: string;
  wallet_valid_months: number;
  cancellation: CancellationSummary | null;
}

/* ── Request checking and error mapping (pure, so it can be tested alone) ── */

export interface CancelRequest {
  refundMethod?: RefundMethod;
  reason: CancelReason;
  note?: string;
}

/** Checks what the browser sent. The server decides every amount, never the browser. */
export function parseCancelRequest(body: unknown): { ok: true; value: CancelRequest } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "Invalid request." };
  }
  const input = body as Record<string, unknown>;

  const reason = input.reason;
  if (typeof reason !== "string" || !CANCEL_REASONS.some((r) => r.value === reason)) {
    return { ok: false, message: "Please choose a reason for cancelling." };
  }

  let refundMethod: RefundMethod | undefined;
  if (input.refundMethod !== undefined && input.refundMethod !== null && input.refundMethod !== "") {
    if (input.refundMethod !== "wallet" && input.refundMethod !== "original") {
      return { ok: false, message: "Choose where the refund should go." };
    }
    refundMethod = input.refundMethod;
  }

  let note: string | undefined;
  if (input.note !== undefined && input.note !== null) {
    if (typeof input.note !== "string" || input.note.length > 500) {
      return { ok: false, message: "Your note is too long." };
    }
    note = input.note.trim() || undefined;
  }

  return { ok: true, value: { refundMethod, reason: reason as CancelReason, note } };
}

/** The HTTP status that goes with a code from the backend. */
export function statusForCancelCode(code: string | undefined): number {
  switch (code) {
    case "not_your_order":
    case "order_not_found":
      return 404;
    case "shipment_created":
    case "preparing":
    case "already_cancelled":
    case "payment_not_settled":
    case "not_trackable":
      return 409;
    case "refund_method_required":
    case "refund_method_unavailable":
    case "invalid_request":
      return 400;
    case "refund_failed":
    case "cancel_failed":
    case "unavailable":
      return 502;
    default:
      return 500;
  }
}

/** "2 hours", "90 minutes": how long the cancel window is, in words. */
export function describeWindow(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${minutes} minutes`;
}

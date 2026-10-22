/**
 * Shared (server and browser) types and labels for return and exchange
 * requests, and the rule for when a customer may make one.
 */

export type ReturnRequestType = "return" | "exchange";

/** The four reasons on offer. Older requests may carry the earlier values, which still read fine. */
export type ReturnRequestReason =
  | "SIZE_ISSUE"
  | "DESIGN_PREFERENCE"
  | "DAMAGED_IN_TRANSIT"
  | "DEFECTIVE"
  | "wrong_size"
  | "damaged_or_defective"
  | "not_as_described"
  | "changed_mind"
  | "other";

export type ReturnRequestStatus =
  | "pending"
  | "pending_fee"
  | "reverse_pickup_scheduled"
  | "awaiting_inspection"
  | "approved"
  | "rejected";

/** What a customer can choose. The codes are the ones the backend accepts. */
export const REQUEST_REASONS: { value: ReturnRequestReason; label: string }[] = [
  { value: "SIZE_ISSUE", label: "Size issue" },
  { value: "DESIGN_PREFERENCE", label: "Design preference" },
  { value: "DAMAGED_IN_TRANSIT", label: "Damaged in transit" },
  { value: "DEFECTIVE", label: "Defective item" },
];

const LEGACY_LABELS: Record<string, string> = {
  wrong_size: "Wrong size",
  damaged_or_defective: "Damaged or defective",
  not_as_described: "Not as described",
  changed_mind: "Changed my mind",
  other: "Something else",
};

export function reasonLabel(reason: string): string {
  return REQUEST_REASONS.find((r) => r.value === reason)?.label ?? LEGACY_LABELS[reason] ?? reason;
}

/** Reasons that need the unboxing video to be looked at. */
export function needsUnboxingVideo(reason: string): boolean {
  return reason === "DAMAGED_IN_TRANSIT" || reason === "DEFECTIVE" || reason === "damaged_or_defective";
}

export const STATUS_LABELS: Record<ReturnRequestStatus, string> = {
  pending: "Under review",
  pending_fee: "Waiting for payment",
  reverse_pickup_scheduled: "Pickup booked",
  awaiting_inspection: "Received, being checked",
  approved: "Completed",
  rejected: "Not approved",
};

/* ── Eligibility ──────────────────────────────────────────── */

export interface Eligibility {
  canReturn: boolean;
  canExchange: boolean;
  /** Last day a return can be requested, once the delivery date is known. */
  returnUntil: string | null;
  exchangeUntil: string | null;
  /** True when we could not confirm delivery; our team checks the date instead. */
  deliveryUnconfirmed: boolean;
  /** Why requests are closed, or null when at least one kind is open. */
  closedReason: "cancelled" | "not_delivered" | "window_closed" | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a customer can ask to return or exchange an order.
 *
 * The windows run from the delivery date, which the courier's tracking
 * updates store on the order. When there is no tracking status at all (for
 * example an order that was never shipped through the courier) the date cannot
 * be checked here, so the request is allowed and our team checks it instead.
 */
export function eligibility(
  order: { status: string; metadata?: Record<string, unknown> | null },
  windows: { returnDays: number; exchangeDays: number },
  now: Date = new Date()
): Eligibility {
  const closed = (closedReason: Eligibility["closedReason"]): Eligibility => ({
    canReturn: false,
    canExchange: false,
    returnUntil: null,
    exchangeUntil: null,
    deliveryUnconfirmed: false,
    closedReason,
  });

  if (order.status === "canceled") return closed("cancelled");

  const status = String(order.metadata?.shiprocket_status ?? "").trim().toUpperCase();
  if (!status) {
    return {
      canReturn: true,
      canExchange: true,
      returnUntil: null,
      exchangeUntil: null,
      deliveryUnconfirmed: true,
      closedReason: null,
    };
  }
  if (status !== "DELIVERED") return closed("not_delivered");

  const stamp = String(order.metadata?.shiprocket_status_updated_at ?? "");
  const deliveredAt = stamp ? new Date(stamp) : null;
  if (!deliveredAt || Number.isNaN(deliveredAt.getTime())) {
    return {
      canReturn: true,
      canExchange: true,
      returnUntil: null,
      exchangeUntil: null,
      deliveryUnconfirmed: true,
      closedReason: null,
    };
  }

  const returnUntil = new Date(deliveredAt.getTime() + windows.returnDays * DAY_MS);
  const exchangeUntil = new Date(deliveredAt.getTime() + windows.exchangeDays * DAY_MS);
  const canReturn = now <= returnUntil;
  const canExchange = now <= exchangeUntil;

  return {
    canReturn,
    canExchange,
    returnUntil: returnUntil.toISOString(),
    exchangeUntil: exchangeUntil.toISOString(),
    deliveryUnconfirmed: false,
    closedReason: canReturn || canExchange ? null : "window_closed",
  };
}

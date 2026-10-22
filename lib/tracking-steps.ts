/**
 * The six stages shown on an order's tracking bar, and what we say when the
 * courier's own tracking feed has nothing for the parcel.
 *
 * The courier's feed is the detailed source, but it can be missing (the courier
 * is down, or the parcel is new). The order itself records the courier's latest
 * status as it arrives, so that is used to place the bar and to say something true.
 */

export type TrackStep = {
  label: string;
  key: string[];
};

export const ORDERED_STEPS: TrackStep[] = [
  { label: "Order Placed", key: ["order placed", "new", "pending"] },
  { label: "Pickup Scheduled", key: ["pickup scheduled", "pickup generated", "pickup queued"] },
  { label: "Picked Up", key: ["picked up", "out for pickup", "in transit"] },
  { label: "Shipped", key: ["shipped", "dispatched", "reached hub", "hub"] },
  { label: "Out for Delivery", key: ["out for delivery"] },
  { label: "Delivered", key: ["delivered"] },
];

export function detectStep(text: string): number {
  const lower = text.toLowerCase();
  for (let i = ORDERED_STEPS.length - 1; i >= 0; i--) {
    if (ORDERED_STEPS[i].key.some((k) => lower.includes(k))) return i;
  }
  return 0;
}

/** True once the parcel is on its way back to us, or has reached us. */
export const isReturningToSender = (status: string): boolean => status.trim().toUpperCase().startsWith("RTO");

/** How far along the bar the order's own recorded status puts it. A parcel coming back is not "delivered". */
export function recordedStep(status: string | null | undefined): number {
  const text = (status ?? "").trim();
  if (!text || isReturningToSender(text)) return 0;
  return detectStep(text);
}

function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

/** What to say under the bar when the courier's feed has no details, or null to keep the usual waiting text. */
export function recordedStatusNote(status: string | null | undefined, at: string | null | undefined): string | null {
  const text = (status ?? "").trim();
  if (!text) return null;
  const when = dateOnly(at);
  if (isReturningToSender(text)) {
    return text.toUpperCase().includes("DELIVERED")
      ? `The parcel was returned to us${when ? ` on ${when}` : ""}.`
      : `The parcel is on its way back to us${when ? ` (since ${when})` : ""}.`;
  }
  const step = detectStep(text);
  if (step === ORDERED_STEPS.length - 1) return `Delivered${when ? ` on ${when}` : ""}.`;
  if (step > 0) return `${ORDERED_STEPS[step].label}${when ? `, updated ${when}` : ""}.`;
  return null;
}

/**
 * What the My Orders list says about an order.
 *
 * Medusa's own fulfilment status stays "not fulfilled" for our orders, because
 * shipping is done through the courier and not through Medusa fulfilments. The
 * order itself records the courier's latest status as it arrives (the same
 * record the order page's tracking bar reads), so that is what the list shows.
 */
import { ORDERED_STEPS, isReturningToSender, recordedStep } from "@/lib/tracking-steps";

export interface OrderListFacts {
  /** Medusa's order status: pending, completed, canceled, ... */
  status: string;
  /** Medusa's fulfilment status: not_fulfilled, fulfilled, ... */
  fulfillment_status: string;
  metadata?: { shiprocket_status?: string | null; dispatch_state?: string | null } | null;
}

export interface OrderListStatus {
  /** The key into the order-status badge: pending, completed, canceled, ... */
  badge: string;
  /** The line next to the badge, or null when the badge says it all. */
  progress: { label: string; done: boolean } | null;
}

const MEDUSA_FULFILMENT: Record<string, { label: string; done: boolean }> = {
  not_fulfilled: { label: "Processing", done: false },
  partially_fulfilled: { label: "Partially Shipped", done: false },
  fulfilled: { label: "Shipped", done: true },
  partially_shipped: { label: "Partially Shipped", done: false },
  shipped: { label: "Shipped", done: true },
  partially_delivered: { label: "Partially Delivered", done: false },
  delivered: { label: "Delivered", done: true },
};

export function orderListStatus(order: OrderListFacts): OrderListStatus {
  // Medusa spells it "canceled"; older code here used "cancelled".
  if (order.status === "canceled" || order.status === "cancelled" || order.fulfillment_status === "canceled") {
    return { badge: "canceled", progress: null };
  }

  const recorded = (order.metadata?.shiprocket_status ?? "").trim();
  if (recorded) {
    if (isReturningToSender(recorded)) {
      const back = recorded.toUpperCase().includes("DELIVERED");
      return { badge: order.status, progress: { label: back ? "Returned to us" : "Returning to us", done: false } };
    }
    const step = recordedStep(recorded);
    if (step === ORDERED_STEPS.length - 1) {
      return { badge: "completed", progress: { label: "Delivered", done: true } };
    }
    if (step > 0) {
      return { badge: order.status, progress: { label: ORDERED_STEPS[step].label, done: true } };
    }
  }

  if (order.metadata?.dispatch_state === "shipped") {
    return { badge: order.status, progress: { label: "Shipped", done: true } };
  }

  return { badge: order.status, progress: MEDUSA_FULFILMENT[order.fulfillment_status] ?? { label: order.fulfillment_status, done: false } };
}

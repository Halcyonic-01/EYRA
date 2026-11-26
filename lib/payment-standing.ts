/**
 * Where a cart's payment stands, as the backend reports it
 * (GET /store/carts/:id/payment-status), and what the customer is told and
 * allowed to do about it. Pure, safe in the browser and on the server.
 *
 * Rules:
 * - Paying (any method, Cash on Delivery included) is allowed only when the
 *   backend says so. Money taken, a payment still in progress, or an answer
 *   that could not be checked never allow paying again.
 * - The checkout never changes the payment method by itself. After a failure
 *   it offers the other methods; the customer picks one.
 */

export type StandingState = "ordered" | "paid" | "pending" | "unknown" | "none";

export interface StandingRefund {
  provider_id: string;
  provider_name: string;
  amount: number;
  status: "refunding" | "refunded" | "paid_out" | "review";
}

export interface PaymentStanding {
  cart_id: string;
  state: StandingState;
  order_id: string | null;
  provider_id: string | null;
  provider_name: string | null;
  pending_since: string | null;
  retry_after: string | null;
  can_pay: boolean;
  allowed_providers: string[] | "any";
  /** The pending try is on the current Razorpay order: paying again continues that order, which can be paid only once. */
  resume?: boolean;
  refunds: StandingRefund[];
}

/** The checkout's payment methods. "prepaid" is Razorpay. */
export type CheckoutMethod = "prepaid" | "payu" | "cod";

export const RAZORPAY_PROVIDER = "pp_razorpay_razorpay";
export const PAYU_PROVIDER = "pp_payu_payu";

const METHOD_PROVIDER: Record<Exclude<CheckoutMethod, "cod">, string> = {
  prepaid: RAZORPAY_PROVIDER,
  payu: PAYU_PROVIDER,
};

/** Whether this method may be used now. Cash on Delivery too: it would leave an online payment behind. */
export function methodAllowed(standing: PaymentStanding | null, method: CheckoutMethod): boolean {
  if (!standing) return true; // Not checked yet: the server checks again before anything is opened.
  if (!standing.can_pay) return false;
  if (standing.allowed_providers === "any") return true;
  return method !== "cod" && standing.allowed_providers.includes(METHOD_PROVIDER[method]);
}

/** Server side: whether an order may be placed without an online payment (COD, wallet only). */
export function mayPlaceWithoutOnlinePayment(standing: PaymentStanding | null): boolean {
  return standing?.state === "none" && standing.can_pay;
}

export type StandingTone = "neutral" | "good" | "warning";

export interface StandingView {
  tone: StandingTone;
  title: string;
  message: string;
  /** Offer a "Check again" button (the state can change at the provider). */
  recheck: boolean;
  /** Keep asking the backend by itself while this is shown. */
  poll: boolean;
}

function minutesUntil(iso: string | null, now: Date): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 60000));
}

/** What to show for a standing. Null when there is nothing to say (nothing paid, nothing pending, no refunds). */
export function standingView(standing: PaymentStanding | null, now: Date = new Date()): StandingView | null {
  if (!standing) return null;
  const gateway = standing.provider_name ?? "your payment provider";
  switch (standing.state) {
    case "ordered":
      return {
        tone: "good",
        title: "Your order is placed",
        message: "This cart has already become an order, so there is nothing more to pay. You'll find it in your orders.",
        recheck: false,
        poll: false,
      };
    case "paid":
      return {
        tone: "good",
        title: "Payment received, confirming your order",
        message: `${gateway} has your payment and we're placing your order now. Please don't pay again.`,
        recheck: true,
        poll: true,
      };
    case "pending": {
      if (standing.resume) {
        return {
          tone: "warning",
          title: `Your ${gateway} payment didn't complete`,
          message: `You can pay again with ${gateway}: it continues the same payment, so you can't be charged twice. To pay another way, please wait until it has settled.`,
          recheck: true,
          poll: true,
        };
      }
      const wait = minutesUntil(standing.retry_after, now);
      return {
        tone: "warning",
        title: `Your ${gateway} payment is still being confirmed`,
        message: standing.can_pay
          ? `It hasn't gone through yet. You can try ${gateway} again; if the earlier payment still completes, it is refunded automatically. To pay another way, please wait until it has settled.`
          : `Please don't pay again. Banks can take a few minutes to confirm UPI and netbanking payments.${wait ? ` If it's still not confirmed, you can try again in about ${wait} minute${wait === 1 ? "" : "s"}.` : ""}`,
        recheck: true,
        poll: true,
      };
    }
    case "unknown":
      return {
        tone: "warning",
        title: "We couldn't check your payment just now",
        message: "To be safe, paying again is paused until we can confirm whether an earlier payment went through. Please try again in a minute.",
        recheck: true,
        poll: true,
      };
    default:
      if (!standing.refunds.length) return null;
      return {
        tone: "neutral",
        title: "An earlier payment is being refunded",
        message: "It couldn't become your order, so it goes back to you in full. You can pay for this cart again as usual.",
        recheck: false,
        poll: false,
      };
  }
}

/** A refund in the customer's words. */
export function refundLine(refund: StandingRefund): string {
  const amount = `₹${refund.amount.toLocaleString("en-IN")}`;
  switch (refund.status) {
    case "paid_out":
      return `${amount} refunded to your ${refund.provider_name} payment method.`;
    case "refunded":
      return `${amount} refund started with ${refund.provider_name}. Banks usually show it within 5 to 7 working days.`;
    case "refunding":
      return `${amount} refund is being sent to ${refund.provider_name}.`;
    default:
      return `${amount} refund is being checked by our team. We'll email you once it's sent.`;
  }
}

/** How often the checkout asks again while a payment is unsettled. */
export const STANDING_POLL_MS = 10000;

/** A failed or abandoned attempt, as the checkout tells it before offering the other methods. */
export function failureMessage(reason: "failed" | "closed", detail?: string | null): string {
  if (reason === "failed") {
    return `${detail ? `${detail.replace(/\.$/, "")}. ` : "The payment didn't go through. "}No money was taken. You can try again or choose another payment method.`;
  }
  return "The payment window was closed before paying. No money was taken. You can try again or choose another payment method.";
}

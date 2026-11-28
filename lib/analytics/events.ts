/**
 * Every event the storefront sends, and exactly what it carries. The single
 * contract for product analytics: a new event is added here first, and
 * TypeScript then refuses anything else at the call sites.
 *
 * Naming: snake_case, object then past-tense verb ("product_viewed"), so
 * events sort by what they are about in PostHog. Properties are ids, amounts
 * in rupees and fixed categories only: never names, emails, phone numbers,
 * addresses or free text a customer typed.
 *
 * The backend sends order_placed and order_cancelled itself (the order is
 * known for certain only there).
 */

/** How the customer pays. The checkout's internal "prepaid" is Razorpay. */
export type PaymentMethodName = "razorpay" | "payu" | "cod" | "wallet";

/** Why a payment did not complete, as a fixed category. */
export type PaymentFailureReason =
  /** The gateway declined it (the customer can retry). */
  | "declined"
  /** The customer closed the payment window or cancelled at the gateway. */
  | "abandoned"
  /** We refused to open it (prices changed, already paid, a payment still pending). */
  | "refused"
  /** Paid, but not confirmed yet; the backend finishes it. Counted to watch the rate. */
  | "unconfirmed"
  /** Could not be started (network, gateway or backend trouble). */
  | "error";

export interface AnalyticsEvents {
  product_viewed: {
    product_id: string;
    product_type: string;
    price: number;
    in_stock: boolean;
  };
  product_added_to_cart: {
    product_id: string;
    variant_id: string | null;
    product_type: string;
    quantity: number;
    price: number;
  };
  product_removed_from_cart: {
    product_id: string;
    variant_id: string | null;
    quantity: number;
  };
  checkout_started: {
    item_count: number;
    cart_value: number;
  };
  payment_method_selected: {
    method: PaymentMethodName;
  };
  payment_started: {
    method: PaymentMethodName;
    amount: number;
  };
  payment_failed: {
    method: PaymentMethodName;
    reason: PaymentFailureReason;
  };
  /** After a failure, the customer chose another way to pay (manual fallback). */
  payment_method_switched: {
    from: PaymentMethodName;
    to: PaymentMethodName;
  };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

/** The checkout's own method names, in analytics terms. */
export function methodName(method: "prepaid" | "payu" | "cod", walletOnly = false): PaymentMethodName {
  if (walletOnly) return "wallet";
  return method === "prepaid" ? "razorpay" : method;
}

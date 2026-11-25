/**
 * PayU hosted checkout: the pieces shared by the checkout, the return route and
 * the payment status page. Pure, safe in the browser and on the server.
 *
 * The storefront never decides whether a PayU payment succeeded. The backend
 * checks PayU's hash and asks PayU itself (verify_payment); this file only
 * carries PayU's fields there and turns the backend's answer into words.
 */

/** Shown at checkout only when the backend has PayU set up (the region lists pp_payu_payu). */
export function payuEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PAYU_ENABLED?.trim().toLowerCase() === "true";
}

/* ── The hosted checkout form ─────────────────────────────── */

export interface PayuCheckoutForm {
  action: string;
  method: "POST";
  fields: Record<string, string>;
}

const PAYU_CHECKOUT_HOSTS = ["secure.payu.in", "test.payu.in"];

/**
 * Whether a form may send the customer there: PayU's own checkout over https,
 * or the exact origin given for a local fake (tests only, unset in production).
 */
export function isPayuCheckoutUrl(action: string, extraOrigin?: string | null): boolean {
  let url: URL;
  try {
    url = new URL(action);
  } catch {
    return false;
  }
  if (extraOrigin && url.origin === extraOrigin.replace(/\/$/, "")) return true;
  return url.protocol === "https:" && PAYU_CHECKOUT_HOSTS.includes(url.hostname) && url.pathname === "/_payment";
}

/** The backend's form, checked: a PayU address and string fields with a hash. Null otherwise. */
export function checkedPayuForm(value: unknown, extraOrigin?: string | null): PayuCheckoutForm | null {
  if (!value || typeof value !== "object") return null;
  const form = value as { action?: unknown; method?: unknown; fields?: unknown };
  if (typeof form.action !== "string" || !isPayuCheckoutUrl(form.action, extraOrigin)) return null;
  if (!form.fields || typeof form.fields !== "object" || Array.isArray(form.fields)) return null;
  const entries = Object.entries(form.fields as Record<string, unknown>);
  if (!entries.every(([, v]) => typeof v === "string")) return null;
  const fields = Object.fromEntries(entries) as Record<string, string>;
  if (!fields.txnid || !fields.hash || !fields.key) return null;
  return { action: form.action, method: "POST", fields };
}

/* ── What PayU posts back ─────────────────────────────────── */

/**
 * The fields the backend needs to check PayU's reverse hash and find the
 * attempt, plus mihpayid and unmappedstatus for display. Nothing else is kept:
 * card and bank details PayU adds are dropped here.
 */
export const PAYU_RETURN_FIELDS = [
  "key", "txnid", "amount", "productinfo", "firstname", "email",
  "udf1", "udf2", "udf3", "udf4", "udf5",
  "status", "additional_charges", "hash", "mihpayid", "unmappedstatus",
] as const;

export type PayuReturnFields = Partial<Record<(typeof PAYU_RETURN_FIELDS)[number], string>>;

const MAX_FIELD_LENGTH = 512;

export function pickReturnFields(source: Record<string, unknown>): PayuReturnFields {
  const picked: PayuReturnFields = {};
  for (const name of PAYU_RETURN_FIELDS) {
    const value = source[name];
    if (typeof value === "string" && value.length <= MAX_FIELD_LENGTH) picked[name] = value;
  }
  return picked;
}

/** Enough to ask the backend about: a transaction id and a hash. */
export function looksLikePayuReturn(fields: PayuReturnFields): boolean {
  return !!fields.txnid && !!fields.hash && !!fields.key;
}

/** PayU's own words for a customer who closed or cancelled the payment page. Display only. */
export function cancelledByCustomer(fields: PayuReturnFields): boolean {
  return /cancel/i.test(fields.unmappedstatus ?? "");
}

/* ── The backend's verdict ────────────────────────────────── */

/** What /store/payu/return decided, plus the storefront's own "could not ask" states. */
export type PayuOutcomeStatus =
  | "order"
  | "pending"
  | "processing"
  | "failed"
  | "refunded"
  /** The response did not check out with the backend (bad hash, unknown transaction, nothing to ask about). */
  | "unverified"
  /** The backend could not be reached; ask again. */
  | "unavailable";

export interface PayuStatusAnswer {
  status: PayuOutcomeStatus;
  orderId: string | null;
  cartId: string | null;
  /** PayU's payment id, for the customer to quote. Display only. */
  paymentId: string | null;
  cancelled: boolean;
}

export type PayuView =
  | { kind: "confirmed" }
  | { kind: "waiting"; title: string; message: string }
  | { kind: "failed" | "cancelled" | "refunded" | "unverified"; title: string; message: string };

/** Only "order" is a success, and only because the backend said so. */
export function payuView(answer: Pick<PayuStatusAnswer, "status" | "cancelled">): PayuView {
  switch (answer.status) {
    case "order":
      return { kind: "confirmed" };
    case "pending":
    case "processing":
    case "unavailable":
      return {
        kind: "waiting",
        title: "Confirming your payment",
        message:
          answer.status === "pending"
            ? "PayU has not confirmed this payment yet. Please don't pay again, this page will update by itself."
            : "We're checking your payment with PayU. Please don't pay again, this page will update by itself.",
      };
    case "failed":
      return answer.cancelled
        ? {
            kind: "cancelled",
            title: "Payment cancelled",
            message: "You cancelled the payment, so no money was taken. Your cart is saved and you can try again.",
          }
        : {
            kind: "failed",
            title: "Payment not completed",
            message: "PayU did not take this payment, so no money was taken. Your cart is saved and you can try again.",
          };
    case "refunded":
      return {
        kind: "refunded",
        title: "Your payment is being refunded",
        message:
          "Your cart changed while you were paying, so we couldn't place the order with this payment. The full amount is being refunded to you through PayU.",
      };
    default:
      return {
        kind: "unverified",
        title: "We couldn't confirm this payment",
        message:
          "We couldn't confirm a payment from this page. If money was taken, it will be matched to your order or refunded automatically. Please check your orders before paying again.",
      };
  }
}

/** How long the status page keeps asking before it says it will email instead. */
export const PAYU_POLL_INTERVAL_MS = 4000;
export const PAYU_POLL_ATTEMPTS = 40;

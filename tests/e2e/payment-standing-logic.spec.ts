import { test, expect } from "@playwright/test";
import {
  failureMessage,
  mayPlaceWithoutOnlinePayment,
  methodAllowed,
  PAYU_PROVIDER,
  RAZORPAY_PROVIDER,
  refundLine,
  standingView,
  type CheckoutMethod,
  type PaymentStanding,
} from "../../lib/payment-standing";

// What the checkout lets a customer do for each payment state, and what it
// tells them. Pure logic: no server.

const now = new Date("2026-11-26T10:00:00Z");
const base: PaymentStanding = {
  cart_id: "cart_1", state: "none", order_id: null, provider_id: null, provider_name: null,
  pending_since: null, retry_after: null, can_pay: true, allowed_providers: "any", refunds: [],
};
const standing = (over: Partial<PaymentStanding>): PaymentStanding => ({ ...base, ...over });
const METHODS: CheckoutMethod[] = ["prepaid", "payu", "cod"];
const allowedMethods = (s: PaymentStanding | null) => METHODS.filter((m) => methodAllowed(s, m));

test.describe("which payment methods may be used", () => {
  test("nothing paid or pending: every method", () => {
    expect(allowedMethods(base)).toEqual(METHODS);
    expect(mayPlaceWithoutOnlinePayment(base)).toBe(true);
  });

  test("paid, ordered or unknown: none at all, Cash on Delivery included", () => {
    for (const state of ["paid", "ordered", "unknown"] as const) {
      const s = standing({ state, can_pay: false, allowed_providers: [] });
      expect(allowedMethods(s)).toEqual([]);
      expect(mayPlaceWithoutOnlinePayment(s)).toBe(false);
    }
  });

  test("pending within the hold: none, so the customer is never asked to pay twice", () => {
    const s = standing({ state: "pending", provider_name: "PayU", provider_id: PAYU_PROVIDER, can_pay: false, allowed_providers: [], retry_after: "2026-11-26T10:20:00Z" });
    expect(allowedMethods(s)).toEqual([]);
  });

  test("pending past the hold: the same gateway only, never a switch, never Cash on Delivery", () => {
    expect(allowedMethods(standing({ state: "pending", can_pay: true, allowed_providers: [PAYU_PROVIDER] }))).toEqual(["payu"]);
    expect(allowedMethods(standing({ state: "pending", can_pay: true, allowed_providers: [RAZORPAY_PROVIDER] }))).toEqual(["prepaid"]);
    expect(mayPlaceWithoutOnlinePayment(standing({ state: "pending", can_pay: true, allowed_providers: [PAYU_PROVIDER] }))).toBe(false);
  });

  test("not checked yet: the choice is open, the server checks before anything is opened", () => {
    expect(allowedMethods(null)).toEqual(METHODS);
    expect(mayPlaceWithoutOnlinePayment(null)).toBe(false);
  });
});

test.describe("what the customer is told", () => {
  test("nothing to say when all is clear", () => {
    expect(standingView(base, now)).toBeNull();
  });

  test("pending says not to pay again and when a retry becomes possible", () => {
    const view = standingView(standing({ state: "pending", provider_name: "PayU", can_pay: false, allowed_providers: [], retry_after: "2026-11-26T10:12:00Z" }), now)!;
    expect(view).toMatchObject({ tone: "warning", poll: true, recheck: true });
    expect(view.title).toContain("PayU");
    expect(view.message).toContain("Please don't pay again");
    expect(view.message).toContain("about 12 minutes");
  });

  test("pending past the hold explains a retry is safe and that switching waits", () => {
    const view = standingView(standing({ state: "pending", provider_name: "Razorpay", can_pay: true, allowed_providers: [RAZORPAY_PROVIDER] }), now)!;
    expect(view.message).toContain("try Razorpay again");
    expect(view.message).toContain("refunded automatically");
  });

  test("a Razorpay try left in limbo can be continued with Razorpay only, and says it can't charge twice", () => {
    const s = standing({ state: "pending", provider_name: "Razorpay", provider_id: RAZORPAY_PROVIDER, can_pay: true, allowed_providers: [RAZORPAY_PROVIDER], resume: true });
    expect(METHODS.filter((m) => methodAllowed(s, m))).toEqual(["prepaid"]);
    expect(standingView(s, now)!.message).toContain("can't be charged twice");
  });

  test("paid says the order is being placed; unknown pauses paying rather than guessing", () => {
    expect(standingView(standing({ state: "paid", provider_name: "Razorpay", can_pay: false }), now)!.message).toContain("Please don't pay again");
    expect(standingView(standing({ state: "unknown", can_pay: false }), now)!.message).toContain("paying again is paused");
  });

  test("refunds are described by where they are", () => {
    const refund = { provider_id: PAYU_PROVIDER, provider_name: "PayU", amount: 2499 };
    expect(refundLine({ ...refund, status: "refunding" })).toBe("₹2,499 refund is being sent to PayU.");
    expect(refundLine({ ...refund, status: "refunded" })).toContain("5 to 7 working days");
    expect(refundLine({ ...refund, status: "paid_out" })).toBe("₹2,499 refunded to your PayU payment method.");
    expect(refundLine({ ...refund, status: "review" })).toContain("our team");
    expect(standingView(standing({ refunds: [{ ...refund, status: "refunded" }] }), now)!.title).toContain("being refunded");
  });

  test("a failed or closed attempt says no money was taken", () => {
    expect(failureMessage("failed", "Your bank declined the payment.")).toBe(
      "Your bank declined the payment. No money was taken. You can try again or choose another payment method."
    );
    expect(failureMessage("closed")).toContain("window was closed");
  });
});

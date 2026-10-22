import { test, expect } from "@playwright/test";
import { COD_CHARGE, DISCOUNT_OFFERS, TOTE_MIN_SUBTOTAL, qualifiesForTote, toteShortfall } from "../../config/offers";

// The tote is a message on the storefront, never a product or a line on an order.
// It is offered on orders strictly above 1,499, judged on the price before any discount.

test.describe("complimentary tote threshold", () => {
  test("1,499 does not qualify", () => {
    expect(qualifiesForTote(1499)).toBe(false);
  });

  test("1,500 qualifies", () => {
    expect(qualifiesForTote(1500)).toBe(true);
  });

  test("the threshold is 1,499 and the edges either side behave", () => {
    expect(TOTE_MIN_SUBTOTAL).toBe(1499);
    expect(qualifiesForTote(1498.99)).toBe(false);
    expect(qualifiesForTote(1499.01)).toBe(true);
    expect(qualifiesForTote(0)).toBe(false);
  });

  test("says how much more is needed, and nothing once it qualifies", () => {
    expect(toteShortfall(1499)).toBe(1);
    expect(toteShortfall(1000)).toBe(500);
    expect(toteShortfall(1500)).toBe(0);
    expect(toteShortfall(5000)).toBe(0);
  });
});

test.describe("offer wording", () => {
  test("lists exactly the three approved codes", () => {
    expect(DISCOUNT_OFFERS.map((offer) => offer.code)).toEqual(["WELCOME200", "EYRA350", "EYRA650"]);
    expect(DISCOUNT_OFFERS.map((offer) => offer.amount)).toEqual([200, 350, 650]);
  });

  test("each code is described by its minimum only, with no upper limit", () => {
    const terms = Object.fromEntries(DISCOUNT_OFFERS.map((offer) => [offer.code, offer.terms]));
    expect(terms.WELCOME200).toContain("above ₹1,499");
    expect(terms.EYRA350).toContain("above ₹3,000");
    expect(terms.EYRA650).toContain("above ₹5,000");
    for (const text of Object.values(terms)) {
      expect(text).not.toMatch(/below|up to|from ₹|to ₹|at most|maximum/i);
    }
  });

  test("the COD charge is 99", () => {
    expect(COD_CHARGE).toBe(99);
  });
});

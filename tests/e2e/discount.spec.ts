import { test, expect } from "@playwright/test";
import {
  MAX_DISCOUNT,
  MIN_DISCOUNT,
  isOldFixedOriginal,
  originalFor,
  percentOff,
  productDiscount,
} from "../../lib/discount";

// The "% off" shown on the product page and in the cart. Pure logic.

test.describe("percent off", () => {
  test("is the drop from the original price, rounded to a whole number", () => {
    expect(percentOff(2000, 3200)).toBe(38); // 37.5
    expect(percentOff(1399, 2238)).toBe(37); // 37.49
    expect(percentOff(1000, 2000)).toBe(50);
    expect(percentOff(799, 999)).toBe(20); // 20.02
    expect(percentOff(4299, 7999)).toBe(46); // 46.26
  });

  test("is 0 when there is no discount to show", () => {
    expect(percentOff(1000, 1000)).toBe(0);
    expect(percentOff(1200, 1000)).toBe(0);
    expect(percentOff(1000, 0)).toBe(0);
    expect(percentOff(0, 1000)).toBe(0);
    expect(percentOff(-5, 1000)).toBe(0);
  });

  test("is 0 for a missing or invalid price, never NaN", () => {
    expect(percentOff(NaN, 1000)).toBe(0);
    expect(percentOff(1000, NaN)).toBe(0);
    expect(percentOff(Infinity, 1000)).toBe(0);
    expect(percentOff(1000, Infinity)).toBe(0);
  });

  test("a discount under half a percent is not shown, and a priced item is never 100% off", () => {
    expect(percentOff(9990, 10000)).toBe(0); // 0.1%
    expect(percentOff(1, 100000)).toBe(99);
  });

  test("follows a pair or a quantity, because both prices scale together", () => {
    expect(percentOff(2000 * 3, 3200 * 3)).toBe(percentOff(2000, 3200));
  });
});

test.describe("a product with no real original price", () => {
  const HANDLES = [
    "luna-anklet", "sovereign-signet-ring", "celestial-band-ring", "figaro-link-chain",
    "geometric-dome-ring", "rope-twist-chain", "crystal-floral-anklet", "eyra-signature-silver-ring",
  ];
  const PRICES = [1, 7, 99, 499, 799, 1399, 1499, 1899, 2000, 2799, 3800, 4999, 12999, 99999];

  test("always lands between 35% and 50% off, for any price", () => {
    for (const key of HANDLES) {
      for (const price of PRICES) {
        const pct = percentOff(price, originalFor(price, key));
        expect(pct, `${key} at ${price}`).toBeGreaterThanOrEqual(MIN_DISCOUNT);
        expect(pct, `${key} at ${price}`).toBeLessThanOrEqual(MAX_DISCOUNT);
      }
    }
  });

  test("the original is always above the price charged", () => {
    for (const key of HANDLES) {
      for (const price of PRICES) expect(originalFor(price, key)).toBeGreaterThan(price);
    }
  });

  test("is the same for the same product every time", () => {
    for (const key of HANDLES) expect(productDiscount(key)).toBe(productDiscount(key));
    expect(originalFor(2000, "luna-anklet")).toBe(originalFor(2000, "luna-anklet"));
  });

  test("differs between products instead of one figure for all", () => {
    const seen = new Set(HANDLES.map((key) => percentOff(2000, originalFor(2000, key))));
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  test("Single and Pair of one product show the same discount", () => {
    for (const key of HANDLES) {
      const single = percentOff(1800, originalFor(1800, key));
      const pair = percentOff(3400, originalFor(3400, key));
      expect(Math.abs(single - pair), key).toBeLessThanOrEqual(1);
    }
  });

  test("has no price, so no original, when the price is missing", () => {
    expect(originalFor(0, "luna-anklet")).toBe(0);
    expect(originalFor(NaN, "luna-anklet")).toBe(0);
    expect(originalFor(-10, "luna-anklet")).toBe(0);
  });

  test("recognises the old fixed original that saved carts hold, and nothing else", () => {
    expect(isOldFixedOriginal(2000, 3200)).toBe(true);
    expect(isOldFixedOriginal(1399, 2238)).toBe(true);
    expect(isOldFixedOriginal(2000, 3500)).toBe(false);
    expect(isOldFixedOriginal(2000, 2000)).toBe(false);
  });
});

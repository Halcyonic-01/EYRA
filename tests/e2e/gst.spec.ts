import { test, expect } from "@playwright/test";
import {
  allocateProportionally,
  extractInclusiveGst,
  fromPaise,
  inclusiveChargeAmounts,
  productLineAmounts,
  toPaise,
} from "../../lib/gst";

// Prices include 3% GST. The discount comes off the inclusive amount first, then
// the GST is taken out of what is left: GST = amount x 3 / 103. Everything is
// worked in whole paise, so the base and the GST always add back to the amount.

const intra = (amount: number) => extractInclusiveGst(amount, 3, "Jharkhand", "Jharkhand");
const inter = (amount: number) => extractInclusiveGst(amount, 3, "Maharashtra", "Jharkhand");

test.describe("taking GST out of an inclusive price", () => {
  test("uses amount x 3 / 103", () => {
    // 3,450 x 3 / 103 = 100.4854..., rounded to the paisa.
    const gst = inter(3450);
    expect(gst.gst).toBe(100.49);
    expect(gst.baseAmount).toBe(3349.51);
    expect(gst.amount).toBe(3450);
  });

  test("a round example: 103 is 100 plus 3", () => {
    const gst = inter(103);
    expect(gst.baseAmount).toBe(100);
    expect(gst.gst).toBe(3);
  });

  test("base plus GST is exactly the amount, for every price", () => {
    // Every whole rupee up to 20,000 and a spread of paise, so rounding cannot hide a gap.
    const mismatches: number[] = [];
    for (let rupees = 0; rupees <= 20000; rupees += 1) {
      for (const paise of [0, 1, 49, 50, 51, 99]) {
        const amount = rupees + paise / 100;
        const gst = inter(amount);
        if (toPaise(gst.baseAmount) + toPaise(gst.gst) !== toPaise(amount)) mismatches.push(amount);
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("is the formula, rounded once", () => {
    for (const amount of [1499, 1500, 1899, 2999, 3000, 3450, 3549, 4999, 5001, 5499]) {
      const expected = Math.round((amount * 100 * 3) / 103);
      expect(toPaise(inter(amount).gst)).toBe(expected);
    }
  });

  test("inside the seller's state it is CGST plus SGST, adding back to the GST", () => {
    const gst = intra(3450);
    expect(gst.isInterState).toBe(false);
    expect(gst.rate).toBe(1.5);
    expect(gst.igst).toBe(0);
    expect(gst.cgst).toBe(50.25);
    expect(gst.sgst).toBe(50.24); // the odd paisa goes to CGST
    expect(toPaise(gst.cgst) + toPaise(gst.sgst)).toBe(toPaise(gst.gst));
  });

  test("to another state it is all IGST at the full rate", () => {
    const gst = inter(3450);
    expect(gst.isInterState).toBe(true);
    expect(gst.rate).toBe(3);
    expect(gst.igst).toBe(gst.gst);
    expect(gst.cgst + gst.sgst).toBe(0);
  });

  test("CGST plus SGST always equals the GST, to the paisa", () => {
    const mismatches: number[] = [];
    for (let amount = 1; amount <= 8000; amount += 7) {
      const gst = intra(amount);
      if (toPaise(gst.cgst) + toPaise(gst.sgst) !== toPaise(gst.gst)) mismatches.push(amount);
    }
    expect(mismatches).toEqual([]);
  });

  test("the state comparison ignores case and spaces", () => {
    expect(extractInclusiveGst(1000, 3, " jharkhand ", "Jharkhand").isInterState).toBe(false);
  });

  test("a zero amount has no GST", () => {
    const gst = inter(0);
    expect(gst.gst).toBe(0);
    expect(gst.baseAmount).toBe(0);
  });

  test("paise helpers round trip", () => {
    expect(toPaise(3349.51)).toBe(334951);
    expect(fromPaise(334951)).toBe(3349.51);
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });
});

test.describe("the worked examples in the tax rules", () => {
  test("a 1,499 ring: 1,455.34 taxable, 21.83 CGST and 21.83 SGST", () => {
    const [line] = productLineAmounts([{ id: "a", unit_price: 1499, quantity: 1 }], 0, 3, false);
    expect(line).toMatchObject({ net: 1499, base: 1455.34, gst: 43.66, cgst: 21.83, sgst: 21.83 });
  });

  test("the 99 Cash on Delivery charge at 18%: 83.90 taxable and 15.10 GST", () => {
    expect(inclusiveChargeAmounts(99, 18, true)).toEqual({ amount: 99, base: 83.9, gst: 15.1, cgst: 0, sgst: 0, igst: 15.1 });
    expect(inclusiveChargeAmounts(99, 18, false)).toMatchObject({ base: 83.9, gst: 15.1, cgst: 7.55, sgst: 7.55, igst: 0 });
  });

  test("a 100 charge at 18%: 84.75 taxable and 15.25 GST", () => {
    expect(inclusiveChargeAmounts(100, 18, true)).toMatchObject({ base: 84.75, gst: 15.25 });
  });
});

test.describe("spreading a discount over lines", () => {
  test("the shares always add up to the discount, to the paisa", () => {
    const mismatches: string[] = [];
    for (const total of [1, 99, 20000, 35000, 65000, 12345]) {
      for (const weights of [[1], [1, 1], [1, 1, 1], [200000, 100000], [149900, 150000, 1], [333, 333, 334], [0, 500]]) {
        const shares = allocateProportionally(total, weights);
        if (shares.reduce((sum, v) => sum + v, 0) !== (weights.some((w) => w > 0) ? total : 0)) {
          mismatches.push(`${total} over ${weights}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("is in proportion to the price, with the odd paisa to the largest remainder", () => {
    expect(allocateProportionally(35000, [200000, 100000])).toEqual([23333, 11667]);
    expect(allocateProportionally(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });

  test("a free line takes no discount and carries no tax", () => {
    const lines = productLineAmounts(
      [
        { id: "ring", unit_price: 2000, quantity: 1 },
        { id: "tote", unit_price: 0, quantity: 1 },
      ],
      200,
      3,
      true
    );
    expect(lines[1]).toMatchObject({ gross: 0, discount: 0, net: 0, base: 0, gst: 0 });
    expect(lines[0]).toMatchObject({ gross: 2000, discount: 200, net: 1800 });
  });

  test("a discount larger than the order is capped at the order", () => {
    const [line] = productLineAmounts([{ id: "a", unit_price: 100, quantity: 1 }], 500, 3, true);
    expect(line.net).toBe(0);
    expect(line.gst).toBe(0);
  });
});

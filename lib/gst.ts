/**
 * Indian GST invoice helpers.
 *
 * GST rule this encodes: EYRA's prices already include GST. Sales within the
 * seller's home state split the tax into CGST + SGST (each half the total
 * rate); sales to any other state use IGST at the full rate instead. Both cases
 * show the same total tax, this only affects how it's itemized on the invoice,
 * which is a real, must-not-get-wrong-by-hand compliance detail rather than a
 * display choice. The Cash on Delivery charge is a service at its own rate.
 */

/** Official GST state codes, the first two digits of every GSTIN. */
export const GST_STATE_CODES: Record<string, string> = {
  "jammu and kashmir": "01",
  "himachal pradesh": "02",
  punjab: "03",
  chandigarh: "04",
  uttarakhand: "05",
  haryana: "06",
  delhi: "07",
  rajasthan: "08",
  "uttar pradesh": "09",
  bihar: "10",
  sikkim: "11",
  "arunachal pradesh": "12",
  nagaland: "13",
  manipur: "14",
  mizoram: "15",
  tripura: "16",
  meghalaya: "17",
  assam: "18",
  "west bengal": "19",
  jharkhand: "20",
  odisha: "21",
  chattisgarh: "22",
  "madhya pradesh": "23",
  gujarat: "24",
  "daman and diu": "25",
  "dadra and nagar haveli": "26",
  maharashtra: "27",
  "andhra pradesh (old)": "28",
  karnataka: "29",
  goa: "30",
  lakshadweep: "31",
  kerala: "32",
  "tamil nadu": "33",
  puducherry: "34",
  "andaman and nicobar islands": "35",
  telangana: "36",
  "andhra pradesh": "37",
  ladakh: "38",
};

export function gstStateCode(stateName: string): string {
  return GST_STATE_CODES[stateName.trim().toLowerCase()] ?? "-";
}

/** Rupees to whole paise, so tax is worked out in whole numbers and nothing drifts. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

/** GST taken out of an inclusive amount, in paise. `base + gst === amount`. */
export function extractGstPaise(amountPaise: number, ratePercent: number): { gst: number; base: number } {
  const gst = Math.round((amountPaise * ratePercent) / (100 + ratePercent));
  return { gst, base: amountPaise - gst };
}

/**
 * Splits a total across weights in whole paise, proportionally, so the parts
 * add up to the total exactly. The paise left after rounding down go, one each,
 * to the largest remainders (the earlier line wins a tie).
 */
export function allocateProportionally(totalPaise: number, weightsPaise: readonly number[]): number[] {
  const weightSum = weightsPaise.reduce((sum, weight) => sum + weight, 0);
  if (totalPaise <= 0 || weightSum <= 0) return weightsPaise.map(() => 0);

  const shares = weightsPaise.map((weight) => {
    const exact = (totalPaise * weight) / weightSum;
    const floor = Math.floor(exact);
    return { floor, remainder: exact - floor };
  });
  let left = totalPaise - shares.reduce((sum, share) => sum + share.floor, 0);
  const order = shares
    .map((share, index) => ({ index, remainder: share.remainder }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const result = shares.map((share) => share.floor);
  for (const { index } of order) {
    if (left <= 0) break;
    result[index] += 1;
    left -= 1;
  }
  return result;
}

export interface TaxSplit {
  cgst: number;
  sgst: number;
  igst: number;
}

/**
 * The GST as it is itemised: inside the seller's state half is CGST and half
 * SGST (an odd paisa goes to CGST, so the halves add up); to any other state it
 * is all IGST. All amounts are whole paise.
 */
export function splitGstPaise(gstPaise: number, interState: boolean): TaxSplit {
  if (interState) return { cgst: 0, sgst: 0, igst: gstPaise };
  const cgst = Math.round(gstPaise / 2);
  return { cgst, sgst: gstPaise - cgst, igst: 0 };
}

export function isInterState(buyerState: string, sellerState: string): boolean {
  return buyerState.trim().toLowerCase() !== sellerState.trim().toLowerCase();
}

export interface ProductLineInput {
  id: string;
  unit_price: number;
  quantity: number;
}

export interface ProductLineAmounts {
  id: string;
  /** Price of the whole line before any discount, GST included. */
  gross: number;
  /** This line's share of the order discount. */
  discount: number;
  /** What the customer pays for the line: gross less discount, GST included. */
  net: number;
  /** Taxable value: the net amount without its GST. */
  base: number;
  gst: number;
  cgst: number;
  sgst: number;
  igst: number;
}

/**
 * Per-line amounts for the products of an order. The order's discount is
 * spread over the lines in proportion to their price, then each line's GST is
 * taken out of what is left (GST = net x rate / (100 + rate)), so every line's
 * tax mirrors its share of the net invoice. A free line (the complimentary
 * tote) carries no discount and no tax. Mirrors apps/backend gst-math.ts, which
 * works out credit notes, and both are tested on the same examples.
 */
export function productLineAmounts(
  lines: readonly ProductLineInput[],
  discountRupees: number,
  ratePercent: number,
  interState: boolean
): ProductLineAmounts[] {
  const gross = lines.map((line) => toPaise(line.unit_price * line.quantity));
  const grossTotal = gross.reduce((sum, value) => sum + value, 0);
  const discount = Math.min(Math.max(toPaise(discountRupees), 0), grossTotal);
  const shares = allocateProportionally(discount, gross);

  return lines.map((line, index) => {
    const net = gross[index] - shares[index];
    const { gst, base } = extractGstPaise(net, ratePercent);
    const split = splitGstPaise(gst, interState);
    return {
      id: line.id,
      gross: fromPaise(gross[index]),
      discount: fromPaise(shares[index]),
      net: fromPaise(net),
      base: fromPaise(base),
      gst: fromPaise(gst),
      cgst: fromPaise(split.cgst),
      sgst: fromPaise(split.sgst),
      igst: fromPaise(split.igst),
    };
  });
}

export interface ChargeAmounts {
  /** The charge as the customer pays it, tax included. */
  amount: number;
  base: number;
  gst: number;
  cgst: number;
  sgst: number;
  igst: number;
}

/** A flat charge that includes its GST (the Cash on Delivery charge). */
export function inclusiveChargeAmounts(amountRupees: number, ratePercent: number, interState: boolean): ChargeAmounts {
  const amount = toPaise(amountRupees);
  const { gst, base } = extractGstPaise(amount, ratePercent);
  const split = splitGstPaise(gst, interState);
  return {
    amount: fromPaise(amount),
    base: fromPaise(base),
    gst: fromPaise(gst),
    cgst: fromPaise(split.cgst),
    sgst: fromPaise(split.sgst),
    igst: fromPaise(split.igst),
  };
}

/**
 * The GST inside a price that already includes it, split for an invoice. All
 * amounts are rupees and carry whole paise.
 *
 * `baseAmount + gst === amount`, always: the base is what is left after the
 * GST is taken out of the amount, so the two cannot disagree by a paisa.
 */
export interface InclusiveGst {
  isInterState: boolean;
  /** The rate printed against each tax line: half the total for CGST and SGST, the whole for IGST. */
  rate: number;
  totalRate: number;
  /** The amount the customer pays, GST included, after any discount. */
  amount: number;
  /** The amount without GST. */
  baseAmount: number;
  /** All the GST in the amount. */
  gst: number;
  cgst: number;
  sgst: number;
  igst: number;
}

/**
 * Takes the GST out of an amount that includes it:
 *
 *   GST = amount x rate / (100 + rate)        (3%: amount x 3 / 103)
 *
 * Apply any discount to the inclusive amount first, then call this with what is
 * left. The GST is rounded to the nearest paisa.
 *
 * @param amountRupees the inclusive amount in rupees, after discount
 * @param totalRatePercent e.g. 3 for the standard jewelry GST rate
 */
export function extractInclusiveGst(
  amountRupees: number,
  totalRatePercent: number,
  buyerState: string,
  sellerState: string
): InclusiveGst {
  const amountPaise = toPaise(amountRupees);
  const { gst, base } = extractGstPaise(amountPaise, totalRatePercent);
  const inter = isInterState(buyerState, sellerState);
  const split = splitGstPaise(gst, inter);
  return {
    isInterState: inter,
    rate: inter ? totalRatePercent : totalRatePercent / 2,
    totalRate: totalRatePercent,
    amount: fromPaise(amountPaise),
    baseAmount: fromPaise(base),
    gst: fromPaise(gst),
    cgst: fromPaise(split.cgst),
    sgst: fromPaise(split.sgst),
    igst: fromPaise(split.igst),
  };
}

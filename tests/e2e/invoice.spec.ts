import { test, expect } from "@playwright/test";
import { PDFParse } from "pdf-parse";

import { invoiceFileName, renderInvoicePdf } from "../../lib/invoice-pdf";
import { buildInvoiceView, formatInvoiceAmount, sellerIssues, type InvoiceOrder, type InvoiceSettings } from "../../lib/invoice-view";
import { invoiceInfo } from "../../lib/invoice-kind";

// The invoice on the page and the PDF are drawn from one view, so these check
// the view's numbers and that the PDF is a real, readable file carrying them.

const settings: InvoiceSettings = {
  seller: {
    legalName: "EYRA JEWELS PRIVATE LIMITED",
    gstin: "20AAJCE7349A1Z1",
    addressLine1: "Ward No. 12, Main Road",
    addressLine2: "",
    city: "Garhwa",
    state: "Jharkhand",
    pincode: "822114",
  },
  gstRate: 3,
  hsnCode: "7113",
  codGstRate: 18,
  sacCode: "9997",
};

const address = (province: string) => ({
  first_name: "Asha",
  last_name: "Rao",
  address_1: "12 Lake Road",
  address_2: null,
  city: "Pune",
  province,
  postal_code: "411001",
  phone: "9999999999",
});

/** A COD order: a pair of anklets at 3,800 with EYRA350, and the COD charge. */
function codOrder(overrides: Partial<InvoiceOrder> = {}): InvoiceOrder {
  return {
    id: "order_01",
    display_id: 412,
    customer_id: "cus_1",
    email: "asha@example.com",
    status: "pending",
    metadata: { invoice_number: "EYRA/26-27/00007", invoice_date: "2026-10-18", dispatch_state: "shipped" },
    created_at: "2026-10-17T10:00:00Z",
    currency_code: "inr",
    subtotal: 3800 + 99,
    item_subtotal: 3800,
    discount_total: 350,
    shipping_total: 99,
    total: 3800 - 350 + 99,
    credit_line_total: 0,
    items: [{ id: "i1", title: "Luna Anklet", variant_title: "Pair", quantity: 1, unit_price: 3800 }],
    shipping_address: address("Maharashtra"),
    promotions: [{ code: "EYRA350" }],
    ...overrides,
  };
}

const prepaidOrder = (overrides: Partial<InvoiceOrder> = {}) =>
  codOrder({ shipping_total: 0, subtotal: 3800, total: 3450, ...overrides });

const taxInvoice = (order: InvoiceOrder, s: InvoiceSettings = settings) =>
  buildInvoiceView(order, invoiceInfo(order.metadata), s);

const row = (view: ReturnType<typeof taxInvoice>, label: string) => view.rows.find((r) => r.label === label);

const GOODS_BASE = "Taxable value, HSN 7113 (excl. GST)";
const COD_BASE = "Taxable value, SAC 9997 (excl. GST)";
const COD_LINE = "Cash on Delivery charge (incl. GST)";

test.describe("invoice view", () => {
  test("a tax invoice carries the number, date, HSN and the buyer's state", () => {
    const view = taxInvoice(codOrder());
    expect(view.kind).toBe("tax_invoice");
    expect(view.invoiceNumber).toBe("EYRA/26-27/00007");
    expect(view.dateText).toBe("18 Oct 2026");
    expect(view.lines[0].hsn).toBe("7113");
    expect(view.supply).toEqual({ state: "Maharashtra", stateCode: "27", taxType: "IGST (inter-state)" });
    expect(view.issues).toEqual([]);
  });

  test("lists the pair by its variant at Medusa's price", () => {
    const [pair] = taxInvoice(codOrder()).lines;
    expect(pair.description).toBe("Luna Anklet (Pair)");
    expect(pair.unitPrice).toBe(3800);
    // The order's discount is this line's own here, so it is paid for at 3,450.
    expect(pair.grossAmount).toBe(3800);
    expect(pair.discount).toBe(350);
    expect(pair.amount).toBe(3450);
    expect(pair.kind).toBe("product");
  });
});

test.describe("GST on the invoice", () => {
  test("the discount comes off the inclusive price first, then GST is taken out of what is left", () => {
    const view = taxInvoice(prepaidOrder());
    expect(row(view, "Items (incl. GST)")?.amount).toBe(3800);
    expect(row(view, "Discount (EYRA350)")).toMatchObject({ amount: 350, deduction: true });
    expect(row(view, "Product amount (incl. GST)")?.amount).toBe(3450);
    // 3,450 x 3 / 103 = 100.49; the base is the rest.
    expect(row(view, "IGST (3%)")?.amount).toBe(100.49);
    expect(row(view, GOODS_BASE)?.amount).toBe(3349.51);
  });

  test("it is not the old order of working: tax on the full price, then the whole discount off", () => {
    const view = taxInvoice(prepaidOrder());
    const wrongBase = 3800 - (3800 * 3) / 103 - 350; // 3,339.32
    expect(row(view, GOODS_BASE)?.amount).not.toBeCloseTo(wrongBase, 2);
  });

  test("base plus GST equals the product amount", () => {
    const view = taxInvoice(prepaidOrder());
    const product = row(view, "Product amount (incl. GST)")!.amount;
    const base = row(view, GOODS_BASE)!.amount;
    const igst = row(view, "IGST (3%)")!.amount;
    expect(Math.round(base * 100) + Math.round(igst * 100)).toBe(Math.round(product * 100));
  });

  test("inside the seller's state it splits into CGST and SGST that add up to the GST", () => {
    const view = taxInvoice(prepaidOrder({ shipping_address: address("Jharkhand") }));
    expect(view.supply?.taxType).toBe("CGST + SGST (intra-state)");
    const cgst = row(view, "CGST (1.5%)")!.amount;
    const sgst = row(view, "SGST (1.5%)")!.amount;
    expect(cgst).toBe(50.25);
    expect(sgst).toBe(50.24);
    expect(Math.round(cgst * 100) + Math.round(sgst * 100)).toBe(10049);
    expect(row(view, "IGST (3%)")).toBeUndefined();
  });

  test("without a discount the GST comes out of the whole product price", () => {
    const view = taxInvoice(prepaidOrder({ discount_total: 0, promotions: [], total: 3800 }));
    expect(view.rows.some((r) => r.label.startsWith("Discount"))).toBe(false);
    expect(row(view, "Product amount (incl. GST)")?.amount).toBe(3800);
    expect(row(view, "IGST (3%)")?.amount).toBe(110.68); // 3,800 x 3 / 103
    expect(row(view, GOODS_BASE)?.amount).toBe(3689.32);
  });

  test("amounts print with paise only when they have them", () => {
    expect(formatInvoiceAmount(3450)).toBe("₹3,450");
    expect(formatInvoiceAmount(3349.51)).toBe("₹3,349.51");
    expect(formatInvoiceAmount(100.4)).toBe("₹100.40");
  });
});

test.describe("prepaid and Cash on Delivery totals", () => {
  test("a prepaid order is just the product amount, with free shipping", () => {
    const view = taxInvoice(prepaidOrder());
    expect(row(view, "Shipping")).toMatchObject({ amount: 0, freeWhenZero: true });
    expect(view.lines.some((line) => line.kind === "cod_charge")).toBe(false);
    expect(view.total).toBe(3450);
  });

  test("COD adds exactly 99 as a line of its own, apart from the products", () => {
    const view = taxInvoice(codOrder());
    const lines = view.lines;
    expect(lines).toHaveLength(2);
    expect(lines[0].kind).toBe("product");
    expect(lines[1]).toMatchObject({
      kind: "cod_charge",
      description: COD_LINE,
      quantity: 1,
      unitPrice: 99,
      amount: 99,
      hsn: "9997",
    });
    expect(view.total).toBe(3450 + 99);
  });

  test("the COD charge carries 18% GST under SAC 9997: 83.90 + 15.10 = 99", () => {
    const view = taxInvoice(codOrder());
    expect(row(view, COD_LINE)?.amount).toBe(99);
    expect(row(view, COD_BASE)?.amount).toBe(83.9);
    expect(row(view, "IGST (18%)")?.amount).toBe(15.1);
    expect(Math.round(83.9 * 100) + Math.round(15.1 * 100)).toBe(9900);
  });

  test("inside the seller's state the COD GST is 9% CGST and 9% SGST", () => {
    const view = taxInvoice(codOrder({ shipping_address: address("Jharkhand") }));
    expect(row(view, "CGST (9%)")?.amount).toBe(7.55);
    expect(row(view, "SGST (9%)")?.amount).toBe(7.55);
    expect(row(view, "IGST (18%)")).toBeUndefined();
  });

  test("the COD charge does not change the product's GST", () => {
    const prepaid = taxInvoice(prepaidOrder());
    const cod = taxInvoice(codOrder());
    expect(row(cod, "IGST (3%)")?.amount).toBe(row(prepaid, "IGST (3%)")?.amount);
    expect(row(cod, GOODS_BASE)?.amount).toBe(row(prepaid, GOODS_BASE)?.amount);
    expect(row(cod, "Product amount (incl. GST)")?.amount).toBe(3450);
  });

  test("the tax summary has one group per rate and adds up to the invoice", () => {
    const view = taxInvoice(codOrder());
    expect(view.taxGroups.map((g) => [g.label, g.rate, g.taxable, g.igst, g.gst])).toEqual([
      ["HSN 7113", 3, 3349.51, 100.49, 100.49],
      ["SAC 9997", 18, 83.9, 15.1, 15.1],
    ]);
    // taxable + GST over every group is the whole invoice, to the paisa.
    const paise = view.taxGroups.reduce((sum, g) => sum + Math.round(g.taxable * 100) + Math.round(g.gst * 100), 0);
    expect(paise).toBe(Math.round(view.total * 100));
  });

  test("a prepaid order has no SAC group", () => {
    expect(taxInvoice(prepaidOrder()).taxGroups.map((g) => g.label)).toEqual(["HSN 7113"]);
  });

  test("a credit line Medusa made on a cancel is not shown as wallet credit", () => {
    const view = taxInvoice(
      codOrder({
        total: 0,
        credit_line_total: 4149,
        credit_lines: [{ reference: "payment_collection", amount: 4149 }],
      })
    );
    expect(view.walletCredit).toBeNull();
    expect(view.balancePayable).toBeNull();
    expect(view.total).toBe(4149);
  });

  test("wallet credit is a way of paying, not a price change", () => {
    const view = taxInvoice(codOrder({ credit_line_total: 500, total: 3049 }));
    expect(view.total).toBe(3549);
    expect(view.walletCredit).toBe(500);
    expect(view.balancePayable).toBe(3049);
  });

  test("the invoice total is the order's own total, so the page and the order agree", () => {
    const order = codOrder();
    expect(taxInvoice(order).total).toBe(order.total + (order.credit_line_total ?? 0));
  });

  test("the complimentary tote is a line at zero and changes no amount", () => {
    const tote = { id: "i2", title: "EYRA Tote Bag", variant_title: "Default", quantity: 1, unit_price: 0 };
    const withTote = taxInvoice(prepaidOrder({ items: [...prepaidOrder().items, tote] }));
    const without = taxInvoice(prepaidOrder());
    expect(withTote.lines).toHaveLength(2);
    expect(withTote.lines[1]).toMatchObject({
      kind: "complimentary",
      description: "EYRA Tote Bag (complimentary)",
      unitPrice: 0,
      amount: 0,
      hsn: null,
    });
    expect(withTote.total).toBe(without.total);
    expect(withTote.taxGroups).toEqual(without.taxGroups);
  });
});

test.describe("discount spread over several lines", () => {
  const two = (overrides: Partial<InvoiceOrder> = {}) =>
    prepaidOrder({
      item_subtotal: 3000,
      discount_total: 350,
      subtotal: 3000,
      total: 2650,
      items: [
        { id: "a", title: "Ring", quantity: 1, unit_price: 2000 },
        { id: "b", title: "Chain", quantity: 1, unit_price: 1000 },
      ],
      shipping_address: address("Jharkhand"),
      ...overrides,
    });

  test("each line takes its share before tax, and the shares add up to the discount", () => {
    const view = taxInvoice(two());
    expect(view.lines.map((l) => [l.grossAmount, l.discount, l.amount])).toEqual([
      [2000, 233.33, 1766.67],
      [1000, 116.67, 883.33],
    ]);
    expect(Math.round((view.lines[0].discount + view.lines[1].discount) * 100)).toBe(35000);
    expect(view.hasDiscount).toBe(true);
  });

  test("tax is worked out per line, and base plus GST is the net invoice", () => {
    const view = taxInvoice(two());
    const group = view.taxGroups[0];
    // 1,766.67 x 3/103 = 51.46 and 883.33 x 3/103 = 25.73
    expect(group.gst).toBe(77.19);
    expect(group.taxable).toBe(2572.81);
    expect(Math.round(group.taxable * 100) + Math.round(group.gst * 100)).toBe(265000);
    expect(Math.round(group.cgst * 100) + Math.round(group.sgst * 100)).toBe(Math.round(group.gst * 100));
  });

  test("with no discount no line shows one", () => {
    const view = taxInvoice(two({ discount_total: 0, promotions: [], total: 3000 }));
    expect(view.hasDiscount).toBe(false);
    expect(view.lines.map((l) => l.amount)).toEqual([2000, 1000]);
  });
});

test.describe("a replacement sent in an exchange", () => {
  test("says it was paid for by the item sent back", () => {
    const view = taxInvoice(prepaidOrder({ metadata: { invoice_number: "EYRA/26-27/00009", invoice_date: "2026-10-18", dispatch_state: "shipped", replacement_for_order: "order_original" } }));
    expect(view.notice).toMatch(/replacement sent in an exchange/);
    expect(view.notice).toMatch(/credit note/);
    // An ordinary invoice has no such notice.
    expect(taxInvoice(prepaidOrder()).notice).toBeNull();
  });
});

test.describe("receipts", () => {
  test("before it ships it is a receipt: no number, no HSN, no tax rows, but the COD line is there", () => {
    const view = taxInvoice(codOrder({ metadata: { dispatch_state: "placed" } }));
    expect(view.kind).toBe("receipt");
    expect(view.invoiceNumber).toBeNull();
    expect(view.lines.every((line) => line.hsn === null)).toBe(true);
    expect(view.rows.some((r) => /^(CGST|SGST|IGST)|^Taxable value/.test(r.label))).toBe(false);
    expect(view.taxGroups).toEqual([]);
    expect(view.lines.some((line) => line.kind === "cod_charge")).toBe(true);
    expect(view.notice).toMatch(/not a tax invoice/);
    expect(view.issues).toEqual([]);
  });

  test("a cancelled order says no tax invoice will be issued", () => {
    const view = taxInvoice(codOrder({ status: "canceled", metadata: { dispatch_state: "cancelled" } }));
    expect(view.notice).toMatch(/cancelled/);
  });
});

test.describe("seller GSTIN", () => {
  test("a missing GSTIN is reported, never invented", () => {
    const view = taxInvoice(codOrder(), { ...settings, seller: { ...settings.seller, gstin: "" } });
    expect(view.issues[0]).toMatch(/SELLER_GSTIN/);
    expect(view.seller.gstin).toBe("");
  });

  test("a malformed GSTIN is reported", () => {
    expect(sellerIssues({ ...settings.seller, gstin: "NOT-A-GSTIN" })[0]).toMatch(/15-character/);
    expect(sellerIssues({ ...settings.seller, gstin: "20aajce7349a1z1" })).toEqual([]);
  });
});

test.describe("invoice PDF", () => {
  async function text(bytes: Buffer): Promise<{ text: string; pages: number }> {
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    const parsed = await parser.getText();
    return { text: parsed.text, pages: parsed.total };
  }

  test("the tote bag line says complimentary and does not print its Default variant name", () => {
    const view = taxInvoice(
      codOrder({
        items: [
          { id: "i1", title: "Luna Anklet", variant_title: "Pair", quantity: 1, unit_price: 3800 },
          { id: "i2", title: "EYRA Tote Bag", variant_title: "Default", quantity: 1, unit_price: 0 },
        ],
      })
    );
    const descriptions = view.lines.map((line) => line.description);
    expect(descriptions).toContain("EYRA Tote Bag (complimentary)");
    expect(descriptions.join(" ")).not.toMatch(/Default/);
    expect(descriptions).toContain("Luna Anklet (Pair)");
  });

  test("a receipt does not list the discounted items under the same name twice", () => {
    const receipt = buildInvoiceView(codOrder({ metadata: {} }), invoiceInfo({}), settings);
    const labels = receipt.rows.map((r) => r.label);
    expect(labels).toContain("Items (incl. GST)");
    expect(labels).toContain("Items after discount (incl. GST)");
    expect(new Set(labels).size).toBe(labels.length);
  });

  test("the footer carries the BIS hallmarking registration number when it is set", async () => {
    const withBis = taxInvoice(codOrder(), { ...settings, bisRegistration: "HM/C-5890248421" });
    expect(withBis.bisLine).toBe("BIS Hallmarking registration no. HM/C-5890248421");
    const { text: body, pages } = await text((await renderInvoicePdf(withBis)).bytes);
    expect(pages).toBe(1);
    expect(body).toContain("HM/C-5890248421");

    // Not set: no line at all, and nothing says "undefined".
    const without = taxInvoice(codOrder());
    expect(without.bisLine).toBeNull();
    expect((await text((await renderInvoicePdf(without)).bytes)).text).not.toMatch(/BIS Hallmarking|undefined/);
  });

  test("is a real, readable PDF with the invoice's facts", async () => {
    const view = taxInvoice(codOrder());
    const pdf = await renderInvoicePdf(view);

    expect(pdf.bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.bytes.subarray(-8).toString()).toContain("%%EOF");
    expect(pdf.filename).toBe("EYRA-26-27-00007.pdf");

    const { text: body, pages } = await text(pdf.bytes);
    expect(pages).toBe(1);
    for (const fact of [
      "TAX INVOICE",
      "EYRA/26-27/00007",
      "EYRA JEWELS PRIVATE LIMITED",
      "20AAJCE7349A1Z1",
      "Luna Anklet (Pair)",
      "₹3,800",
      "Discount (EYRA350)",
      "- ₹350",
      "Product amount (incl. GST)",
      "₹3,450",
      "Taxable value, HSN 7113 (excl. GST)",
      "₹3,349.51",
      "IGST (3%)",
      "₹100.49",
      "Cash on Delivery charge (incl. GST)",
      "Taxable value, SAC 9997 (excl. GST)",
      "₹83.90",
      "IGST (18%)",
      "₹15.10",
      "Tax summary".toUpperCase(),
      "₹99",
      "₹3,549",
      "Maharashtra (27)",
      "7113",
      "9997",
    ]) {
      expect(body).toContain(fact);
    }
    expect(body).not.toContain("NOT A VALID TAX INVOICE");
  });

  test("the same invoice reads the same every time it is drawn", async () => {
    const view = taxInvoice(codOrder());
    const first = await text((await renderInvoicePdf(view)).bytes);
    const second = await text((await renderInvoicePdf(view)).bytes);
    expect(second.text).toBe(first.text);
    expect(first.text).toContain("EYRA/26-27/00007");
  });

  test("a missing GSTIN stamps the PDF as not valid instead of passing it off", async () => {
    const view = taxInvoice(codOrder(), { ...settings, seller: { ...settings.seller, gstin: "" } });
    const { text: body } = await text((await renderInvoicePdf(view)).bytes);
    expect(body).toContain("NOT A VALID TAX INVOICE");
    expect(body).toContain("SELLER_GSTIN");
  });

  test("a receipt PDF says it is not a tax invoice", async () => {
    const view = taxInvoice(codOrder({ metadata: { dispatch_state: "placed" } }));
    const pdf = await renderInvoicePdf(view);
    expect(pdf.filename).toBe("EYRA-order-412.pdf");
    const { text: body } = await text(pdf.bytes);
    expect(body).toContain("ORDER RECEIPT");
    expect(body).toContain("not a tax invoice");
  });

  test("file names are safe", () => {
    const view = taxInvoice(codOrder({ metadata: { invoice_number: "EYRA/26-27/00007 ../x", dispatch_state: "shipped" } }));
    expect(invoiceFileName(view)).toMatch(/^[A-Za-z0-9._-]+\.pdf$/);
  });
});

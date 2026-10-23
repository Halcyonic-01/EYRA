import { test, expect } from "@playwright/test";
import { PDFParse } from "pdf-parse";

import { creditNoteFileName, renderCreditNotePdf } from "../../lib/credit-note-pdf";
import { buildCreditNoteView, creditNoteIssues, reasonText, type CreditNotePayload } from "../../lib/credit-note-view";

// A credit note is drawn exactly as the backend issued it. These check the view's
// arrangement and that the PDF is a real file carrying the document's facts; the
// amounts themselves are the backend's, and are tested there.

const base: CreditNotePayload = {
  credit_note_number: "CN/26-27/0042",
  credit_note_date: "2026-10-21T15:58:00+05:30",
  original_invoice_number: "EYRA/26-27/01089",
  original_invoice_date: "2026-10-15T10:30:00+05:30",
  kind: "return",
  reason: "SIZE_ISSUE",
  order: { id: "order_1", display_id: 1089 },
  seller: {
    legal_name: "EYRA JEWELS PRIVATE LIMITED",
    gstin: "20AAJCE7349A1Z1",
    address: ["Ward No. 12, Main Road", "Garhwa, Jharkhand 822114"],
    state: "Jharkhand",
    state_code: "20",
  },
  customer_details: { name: "Jane Doe", gstin: null, state: "Jharkhand", state_code: "20" },
  place_of_supply: { state: "Jharkhand", state_code: "20", tax_type: "CGST+SGST" },
  line_items: [
    {
      item_id: "i1",
      hsn_sac: "7113",
      description: "Sterling Silver Ring (Size 12)",
      quantity: 1,
      taxable_value: 1455.34,
      gst_rate: 3,
      cgst: 21.83,
      sgst: 21.83,
      igst: 0,
      total: 1499,
    },
  ],
  totals: { taxable_value: 1455.34, cgst: 21.83, sgst: 21.83, igst: 0, total_tax: 43.66, total: 1499 },
  adjustments: {
    reverse_logistics_fee_deduction: 99,
    net_store_credit_issued: 1400,
    net_refund_amount: 0,
    credit_method: "store_credit",
    fee: { type: "reverse_logistics", description: "Reverse logistics fee", sac: "9997", gst_rate: 18, amount: 99, taxable_value: 83.9, cgst: 7.55, sgst: 7.55, igst: 0 },
  },
  currency: "INR",
};

const igstNote: CreditNotePayload = {
  ...base,
  customer_details: { ...base.customer_details, state: "Karnataka", state_code: "29" },
  place_of_supply: { state: "Karnataka", state_code: "29", tax_type: "IGST" },
  line_items: [{ ...base.line_items[0], cgst: 0, sgst: 0, igst: 43.66 }],
  totals: { ...base.totals, cgst: 0, sgst: 0, igst: 43.66 },
  adjustments: {
    ...base.adjustments,
    fee: { type: "reverse_logistics", description: "Reverse logistics fee", sac: "9997", gst_rate: 18, amount: 99, taxable_value: 83.9, cgst: 0, sgst: 0, igst: 15.1 },
  },
};

const row = (view: ReturnType<typeof buildCreditNoteView>, label: string) => view.rows.find((r) => r.label === label);

test.describe("credit note view", () => {
  test("names the note, the invoice it reverses and the order", () => {
    const view = buildCreditNoteView(base);
    expect(view.heading).toBe("Credit Note");
    expect(view.creditNoteNumber).toBe("CN/26-27/0042");
    expect(view.dateText).toBe("21 Oct 2026");
    expect(view.originalInvoiceNumber).toBe("EYRA/26-27/01089");
    expect(view.originalInvoiceDateText).toBe("15 Oct 2026");
    expect(view.orderNumber).toBe(1089);
    expect(view.reasonText).toBe("Size issue");
  });

  test("shows CGST and SGST inside the seller's state, and the store credit after the fee", () => {
    const view = buildCreditNoteView(base);
    expect(view.igst).toBe(false);
    expect(row(view, "Taxable value")?.amount).toBe(1455.34);
    expect(row(view, "CGST (1.5%)")?.amount).toBe(21.83);
    expect(row(view, "SGST (1.5%)")?.amount).toBe(21.83);
    expect(row(view, "Credit note value (incl. GST)")?.amount).toBe(1499);
    expect(row(view, "Less: reverse logistics fee (incl. 18% GST)")).toMatchObject({ amount: 99, deduction: true });
    // The fee's own GST: 83.90 + 15.10, split 9% and 9%.
    expect(row(view, "Taxable value, SAC 9997 (excl. GST)")?.amount).toBe(83.9);
    expect(row(view, "CGST (9%)")?.amount).toBe(7.55);
    expect(row(view, "SGST (9%)")?.amount).toBe(7.55);
    expect(row(view, "Store credit issued")?.amount).toBe(1400);
  });

  test("a damaged item has no fee rows, and the whole value comes back", () => {
    const view = buildCreditNoteView({
      ...base,
      reason: "DEFECTIVE",
      adjustments: { reverse_logistics_fee_deduction: 0, net_store_credit_issued: 1499, net_refund_amount: 0, credit_method: "store_credit", fee: null },
    });
    expect(view.rows.some((r) => /fee/i.test(r.label))).toBe(false);
    expect(row(view, "Store credit issued")?.amount).toBe(1499);
  });

  test("an exchange has no fee rows, and the whole item is adjusted against the replacement", () => {
    const view = buildCreditNoteView({
      ...base,
      kind: "exchange",
      reason: "DESIGN_PREFERENCE",
      adjustments: { reverse_logistics_fee_deduction: 0, net_store_credit_issued: 0, net_refund_amount: 0, credit_method: "exchange_adjustment", fee: null },
    });
    expect(view.rows.some((r) => /fee/i.test(r.label))).toBe(false);
    expect(row(view, "Adjusted against your exchange")?.amount).toBe(1499);
  });

  test("an order cancelled before it was paid for says no money goes back", () => {
    const view = buildCreditNoteView({
      ...base,
      kind: "cancellation",
      reason: "CANCELLED_AFTER_DISPATCH",
      adjustments: { reverse_logistics_fee_deduction: 0, net_store_credit_issued: 0, net_refund_amount: 0, credit_method: "none", fee: null },
    });
    expect(row(view, "Refund amount (no payment was collected)")?.amount).toBe(0);
    expect(row(view, "Refund amount")).toBeUndefined();
  });

  test("the credit note value comes first, with what it is made of indented under it", () => {
    const view = buildCreditNoteView(base);
    const labels = view.rows.map((r) => r.label);
    expect(labels.indexOf("Credit note value (incl. GST)")).toBe(0);
    expect(view.rows[0].indent).toBeFalsy();
    // Every part of the value and of the fee is indented the same way.
    const parts = view.rows.filter((r) => /^(Taxable value|CGST|SGST|IGST)/.test(r.label));
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.every((r) => r.indent === true)).toBe(true);
    // The headline lines stay at the left edge.
    for (const label of ["Credit note value (incl. GST)", "Store credit issued"]) {
      expect(view.rows.find((r) => r.label === label)?.indent).toBeFalsy();
    }
  });

  test("a note with no number, GSTIN, invoice or lines is not valid", () => {
    expect(creditNoteIssues(base)).toEqual([]);
    expect(creditNoteIssues({ ...base, credit_note_number: null })).toHaveLength(1);
    expect(creditNoteIssues({ ...base, seller: { ...base.seller, gstin: "" } })).toHaveLength(1);
    expect(creditNoteIssues({ ...base, original_invoice_number: "" })).toHaveLength(1);
    expect(creditNoteIssues({ ...base, line_items: [] })).toHaveLength(1);
  });

  test("reasons read in plain words", () => {
    expect(reasonText("DAMAGED_IN_TRANSIT")).toBe("Damaged in transit");
    expect(reasonText("DEFECTIVE")).toBe("Defective item");
    expect(reasonText("some_other_reason")).toBe("Some other reason");
  });
});

test.describe("credit note PDF", () => {
  async function text(bytes: Buffer): Promise<{ text: string; pages: number }> {
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    const parsed = await parser.getText();
    return { text: parsed.text, pages: parsed.total };
  }

  test("the footer carries the BIS hallmarking registration number when it is set", async () => {
    const withBis = buildCreditNoteView(base, { bisRegistration: "HM/C-5890248421" });
    expect(withBis.bisLine).toBe("BIS Hallmarking registration no. HM/C-5890248421");
    const { text: body } = await text((await renderCreditNotePdf(withBis)).bytes);
    expect(body).toContain("HM/C-5890248421");

    const without = buildCreditNoteView(base);
    expect(without.bisLine).toBeNull();
    expect((await text((await renderCreditNotePdf(without)).bytes)).text).not.toMatch(/BIS Hallmarking|undefined/);
  });

  test("is a real, readable PDF with the credit note's facts", async () => {
    const view = buildCreditNoteView(base);
    const pdf = await renderCreditNotePdf(view);
    expect(pdf.bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.bytes.subarray(-8).toString()).toContain("%%EOF");
    expect(pdf.filename).toBe("CN-26-27-0042.pdf");
    expect(creditNoteFileName(view)).toBe("CN-26-27-0042.pdf");

    const { text: body, pages } = await text(pdf.bytes);
    expect(pages).toBe(1);
    for (const fact of [
      "CREDIT NOTE",
      "CN/26-27/0042",
      "EYRA/26-27/01089",
      "15 Oct 2026",
      "EYRA JEWELS PRIVATE LIMITED",
      "20AAJCE7349A1Z1",
      "Sterling Silver Ring (Size 12)",
      "7113",
      "₹1,455.34",
      "₹21.83",
      "₹1,499",
      "Less: reverse logistics fee (incl. 18% GST)",
      "- ₹99",
      "Taxable value, SAC 9997 (excl. GST)",
      "₹83.90",
      "₹7.55",
      "Store credit issued",
      "₹1,400",
      "Size issue",
      "Jharkhand (20)",
    ]) {
      expect(body).toContain(fact);
    }
  });

  test("an IGST note carries the IGST and no CGST", async () => {
    const { text: body } = await text((await renderCreditNotePdf(buildCreditNoteView(igstNote))).bytes);
    expect(body).toContain("IGST");
    expect(body).toContain("₹43.66");
    expect(body).toContain("Karnataka (29)");
    expect(body).not.toContain("CGST (1.5%)");
  });

  test("is the same every time it is drawn", async () => {
    const view = buildCreditNoteView(base);
    const first = await text((await renderCreditNotePdf(view)).bytes);
    const second = await text((await renderCreditNotePdf(view)).bytes);
    expect(second.text).toBe(first.text);
  });

  test("file names are safe", () => {
    const view = buildCreditNoteView({ ...base, credit_note_number: "CN/26-27/0042 ../x" });
    expect(creditNoteFileName(view)).toMatch(/^[A-Za-z0-9._-]+\.pdf$/);
  });
});

test.describe("credit note routes", () => {
  test("drawing a PDF is for the backend only", async ({ request }) => {
    const none = await request.post("/api/credit-notes/render", { data: { credit_note: base } });
    expect([401, 503]).toContain(none.status());
    const wrong = await request.post("/api/credit-notes/render", {
      data: { credit_note: base },
      headers: { "x-shipment-secret": "not-the-secret" },
    });
    expect([401, 503]).toContain(wrong.status());
  });

  test("a customer's download needs sign-in, and a note id alone reveals nothing", async ({ request }) => {
    // The site sends a guest to sign in (a redirect); the route itself answers 401 if it is ever reached.
    const res = await request.get("/orders/order_does_not_matter/credit-notes/crn_does_not_matter/pdf", { maxRedirects: 0 });
    expect([307, 401]).toContain(res.status());
    if (res.status() === 307) expect(res.headers()["location"]).toContain("sign-in");
  });
});

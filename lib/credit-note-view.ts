/**
 * What a credit note says, from the document the backend issued. The numbers are
 * the backend's (it worked them out when it numbered the note), so nothing here
 * recalculates a rupee: it only arranges the document for reading. Pure, so the
 * PDF can be tested without a browser.
 */
import { formatInvoiceAmount } from "@/lib/invoice-view";

export interface CreditNotePayloadLine {
  item_id: string;
  hsn_sac: string;
  description: string;
  quantity: number;
  taxable_value: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

/** The credit note document the backend stores and sends. Mirrors apps/backend credit-note/document.ts. */
export interface CreditNotePayload {
  credit_note_number: string | null;
  credit_note_date: string | null;
  original_invoice_number: string;
  original_invoice_date: string;
  kind: "return" | "exchange" | "cancellation" | "rto";
  reason: string;
  order: { id: string; display_id: number };
  seller: { legal_name: string; gstin: string; address: string[]; state: string; state_code: string };
  customer_details: { name: string; gstin: string | null; state: string; state_code: string };
  place_of_supply: { state: string; state_code: string; tax_type: "CGST+SGST" | "IGST" };
  line_items: CreditNotePayloadLine[];
  totals: { taxable_value: number; cgst: number; sgst: number; igst: number; total_tax: number; total: number };
  adjustments: {
    reverse_logistics_fee_deduction: number;
    net_store_credit_issued: number;
    net_refund_amount: number;
    credit_method: "store_credit" | "refund" | "exchange_adjustment" | "none";
    /** The fee kept or paid, with the 18% GST inside it. Null when there is none. */
    fee?: {
      type: "reverse_logistics";
      description: string;
      sac: string;
      gst_rate: number;
      amount: number;
      taxable_value: number;
      cgst: number;
      sgst: number;
      igst: number;
    } | null;
  };
  currency: "INR";
}

export interface CreditNoteRow {
  label: string;
  amount: number;
  bold?: boolean;
  deduction?: boolean;
  indent?: boolean;
}

export interface CreditNoteView {
  heading: string;
  creditNoteNumber: string;
  dateText: string;
  originalInvoiceNumber: string;
  originalInvoiceDateText: string;
  orderNumber: number;
  reasonText: string;
  seller: { legalName: string; addressLines: string[]; gstin: string };
  buyer: { name: string; state: string; stateCode: string; gstin: string | null };
  supply: { state: string; stateCode: string; taxType: string };
  igst: boolean;
  lines: CreditNotePayloadLine[];
  rows: CreditNoteRow[];
  footnote: string;
  /** The BIS hallmarking registration line for the footer, or null when the number is not set. */
  bisLine: string | null;
}

const REASONS: Record<string, string> = {
  SIZE_ISSUE: "Size issue",
  DESIGN_PREFERENCE: "Design preference",
  DAMAGED_IN_TRANSIT: "Damaged in transit",
  DEFECTIVE: "Defective item",
  CANCELLED_AFTER_DISPATCH: "Order cancelled after dispatch",
  DELIVERY_REFUSED: "Delivery refused, parcel returned to us",
  EXCHANGE: "Exchange",
};

export function reasonText(reason: string): string {
  const known = REASONS[reason.toUpperCase()];
  if (known) return known;
  const spaced = reason.replace(/[_-]+/g, " ").trim().toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Return";
}

function dateText(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function creditNoteIssues(payload: CreditNotePayload): string[] {
  const issues: string[] = [];
  if (!payload.credit_note_number) issues.push("The credit note has no number.");
  if (!payload.seller?.gstin) issues.push("The credit note has no seller GSTIN.");
  if (!payload.original_invoice_number) issues.push("The credit note does not name its original invoice.");
  if (!Array.isArray(payload.line_items) || payload.line_items.length === 0) issues.push("The credit note has no lines.");
  return issues;
}

const half = (rate: number, igst: boolean) => (igst ? rate : rate / 2);

export function buildCreditNoteView(payload: CreditNotePayload, options: { bisRegistration?: string } = {}): CreditNoteView {
  const igst = payload.place_of_supply.tax_type === "IGST";
  const rates = [...new Set(payload.line_items.map((line) => line.gst_rate))];
  const rateLabel = rates.length === 1 ? ` (${half(rates[0], igst)}%)` : "";

  // The total first, then what it is made of, indented under it. The fee below follows the same pattern.
  const rows: CreditNoteRow[] = [
    { label: "Credit note value (incl. GST)", amount: payload.totals.total, bold: true },
    { label: "Taxable value", amount: payload.totals.taxable_value, indent: true },
  ];
  if (igst) {
    rows.push({ label: `IGST${rateLabel}`, amount: payload.totals.igst, indent: true });
  } else {
    rows.push({ label: `CGST${rateLabel}`, amount: payload.totals.cgst, indent: true });
    rows.push({ label: `SGST${rateLabel}`, amount: payload.totals.sgst, indent: true });
  }

  const adj = payload.adjustments;
  const fee = adj.fee ?? null;
  const feeRate = fee ? (igst ? fee.gst_rate : fee.gst_rate / 2) : 0;
  const feeTaxRows = (): CreditNoteRow[] =>
    fee
      ? [
          { label: `Taxable value, SAC ${fee.sac} (excl. GST)`, amount: fee.taxable_value, indent: true },
          ...(igst
            ? [{ label: `IGST (${feeRate}%)`, amount: fee.igst, indent: true }]
            : [
                { label: `CGST (${feeRate}%)`, amount: fee.cgst, indent: true },
                { label: `SGST (${feeRate}%)`, amount: fee.sgst, indent: true },
              ]),
        ]
      : [];
  if (fee && fee.type === "reverse_logistics") {
    rows.push({ label: `Less: ${fee.description.toLowerCase()} (incl. ${fee.gst_rate}% GST)`, amount: fee.amount, deduction: true });
    rows.push(...feeTaxRows());
  } else if (adj.reverse_logistics_fee_deduction > 0) {
    rows.push({ label: "Less: reverse logistics fee", amount: adj.reverse_logistics_fee_deduction, deduction: true });
  }
  const net = adj.credit_method === "store_credit" ? adj.net_store_credit_issued : adj.net_refund_amount;
  if (adj.credit_method === "store_credit") {
    rows.push({ label: "Store credit issued", amount: net, bold: true });
  } else if (adj.credit_method === "refund") {
    rows.push({ label: "Refund amount", amount: net, bold: true });
  } else if (adj.credit_method === "none") {
    // The invoice is reversed, but no money was collected, so none goes back.
    rows.push({ label: "Refund amount (no payment was collected)", amount: 0, bold: true });
  } else {
    rows.push({ label: "Adjusted against your exchange", amount: payload.totals.total - adj.reverse_logistics_fee_deduction, bold: true });
  }

  return {
    heading: "Credit Note",
    creditNoteNumber: payload.credit_note_number ?? "",
    dateText: dateText(payload.credit_note_date),
    originalInvoiceNumber: payload.original_invoice_number,
    originalInvoiceDateText: dateText(payload.original_invoice_date),
    orderNumber: payload.order.display_id,
    reasonText: reasonText(payload.reason),
    seller: { legalName: payload.seller.legal_name, addressLines: payload.seller.address, gstin: payload.seller.gstin },
    buyer: {
      name: payload.customer_details.name,
      state: payload.customer_details.state,
      stateCode: payload.customer_details.state_code,
      gstin: payload.customer_details.gstin,
    },
    supply: {
      state: payload.place_of_supply.state,
      stateCode: payload.place_of_supply.state_code,
      taxType: igst ? "IGST (inter-state)" : "CGST + SGST (intra-state)",
    },
    igst,
    lines: payload.line_items,
    rows,
    footnote: "This credit note reverses part or all of the tax invoice named above. It is computer-generated and does not require a signature.",
    bisLine: options.bisRegistration?.trim() ? `BIS Hallmarking registration no. ${options.bisRegistration.trim()}` : null,
  };
}

/** A line's amounts as printed. */
export const money = formatInvoiceAmount;

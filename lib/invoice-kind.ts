/**
 * Whether an order has a GST tax invoice yet, or only an order receipt.
 *
 * A tax invoice is issued when the order ships (the backend records its number
 * and date then), so until that moment there is nothing to cancel or reverse.
 * Orders that shipped before this was tracked have no number but do have
 * shipment details, and keep the invoice they always had.
 */
export interface InvoiceInfo {
  kind: "tax_invoice" | "receipt";
  /** The issued number, for orders shipped since dispatch was tracked. */
  invoiceNumber: string | null;
  /** The issue date, YYYY-MM-DD. */
  invoiceDate: string | null;
  /** Shipped under the earlier flow, so the invoice keeps its old number and date. */
  legacy: boolean;
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

export function invoiceInfo(metadata: Record<string, unknown> | null | undefined): InvoiceInfo {
  const meta = metadata ?? {};

  const invoiceNumber = text(meta.invoice_number);
  if (invoiceNumber) {
    return { kind: "tax_invoice", invoiceNumber, invoiceDate: text(meta.invoice_date), legacy: false };
  }

  if (!text(meta.dispatch_state) && (text(meta.shiprocket_shipment_id) || text(meta.awb_code))) {
    return { kind: "tax_invoice", invoiceNumber: null, invoiceDate: null, legacy: true };
  }

  return { kind: "receipt", invoiceNumber: null, invoiceDate: null, legacy: false };
}

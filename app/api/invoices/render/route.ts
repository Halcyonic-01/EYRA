import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

import { checkShipmentRequest } from "@/lib/internal-auth";
import { invoiceInfo } from "@/lib/invoice-kind";
import { fetchInvoiceOrder } from "@/lib/invoice-order";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { invoiceSettings } from "@/lib/invoice-settings";
import { buildInvoiceView } from "@/lib/invoice-view";

// pdfmake needs Node, and the order is read live.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Draws the GST tax invoice for one shipped order as a PDF and hands it back.
 *
 * Called only by the Medusa backend, which stores the file and keeps it. It does
 * not choose the invoice number: that was issued when the order shipped and is
 * read from the order, so asking again can only ever give the same invoice.
 *
 * Body: { order_id, allow_unverified?: boolean }
 *
 * An order with no invoice number is refused (409). When the seller's GSTIN is
 * missing or malformed the answer is 422 with no file, unless allow_unverified
 * is set, which is for staff viewing a draft: the PDF then carries a plain
 * "not a valid tax invoice" notice and must not be stored.
 */
export async function POST(request: NextRequest) {
  const auth = checkShipmentRequest(request);
  if (auth === "unconfigured") {
    return Response.json({ error: "Invoices are not configured." }, { status: 503 });
  }
  if (auth === "unauthorized") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { order_id?: unknown; allow_unverified?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  if (!orderId.startsWith("order_")) {
    return Response.json({ error: "order_id is required." }, { status: 400 });
  }

  const order = await fetchInvoiceOrder(orderId);
  if (!order) {
    return Response.json({ error: "The order could not be read." }, { status: 502 });
  }

  const info = invoiceInfo(order.metadata);
  if (info.kind !== "tax_invoice") {
    return Response.json(
      { error: "no_invoice", message: "This order has no tax invoice yet. It is issued when the order ships." },
      { status: 409 }
    );
  }

  const view = buildInvoiceView(order, info, invoiceSettings());

  if (view.issues.length && body.allow_unverified !== true) {
    return Response.json({ error: "invoice_not_valid", message: view.issues.join(" "), issues: view.issues }, { status: 422 });
  }

  try {
    const pdf = await renderInvoicePdf(view);
    return Response.json({
      filename: pdf.filename,
      invoice_number: view.invoiceNumber,
      sha256: createHash("sha256").update(pdf.bytes).digest("hex"),
      unverified: view.issues.length > 0,
      pdf_base64: pdf.bytes.toString("base64"),
    });
  } catch (error) {
    console.error("[invoices/render] could not draw the PDF for", orderId, ":", error);
    return Response.json({ error: "render_failed", message: "The PDF could not be drawn." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { invoiceInfo } from "@/lib/invoice-kind";
import { fetchInvoiceOrder } from "@/lib/invoice-order";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { invoiceSettings } from "@/lib/invoice-settings";
import { buildInvoiceView } from "@/lib/invoice-view";
import { applyRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BACKEND = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

function pdfResponse(bytes: Uint8Array, filename: string): Response {
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // An invoice is for its owner only: nothing may keep a shared copy.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** The stored copy, from the backend. Null when it is not available right now. */
async function fetchStoredPdf(orderId: string): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const key = process.env.MEDUSA_ADMIN_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BACKEND}/admin/orders/${encodeURIComponent(orderId)}/invoice`, {
      headers: { Authorization: `Basic ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("application/pdf")) return null;
    const disposition = res.headers.get("content-disposition") ?? "";
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "EYRA-invoice.pdf";
    return { bytes: new Uint8Array(await res.arrayBuffer()), filename };
  } catch (error) {
    console.error("[invoice/pdf] could not read the stored invoice for", orderId, ":", error);
    return null;
  }
}

/**
 * The tax invoice as a PDF, for the customer who placed the order and nobody
 * else. The stored copy is served when it exists; if the backend cannot be
 * reached the same invoice is drawn from the order, so a customer is never left
 * without it. The file is never given a public address.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await applyRateLimit(req, "invoice_pdf", 60);
  if (limited) return limited;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  const { id } = await params;
  if (!id.startsWith("order_")) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  const order = await fetchInvoiceOrder(id);
  const customerId = user.publicMetadata?.medusaCustomerId;
  // The same answer for "not yours" and "not there", so an id reveals nothing.
  if (!order || typeof customerId !== "string" || order.customer_id !== customerId) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const info = invoiceInfo(order.metadata);
  if (info.kind !== "tax_invoice") {
    return NextResponse.json(
      { error: "no_invoice", message: "Your tax invoice is issued when your order is dispatched." },
      { status: 409 }
    );
  }

  const stored = await fetchStoredPdf(id);
  if (stored) return pdfResponse(stored.bytes, stored.filename);

  const view = buildInvoiceView(order, info, invoiceSettings());
  if (view.issues.length) {
    return NextResponse.json(
      { error: "invoice_unavailable", message: "Your invoice is being prepared. Please try again later." },
      { status: 503 }
    );
  }
  const pdf = await renderInvoicePdf(view);
  return pdfResponse(pdf.bytes, pdf.filename);
}

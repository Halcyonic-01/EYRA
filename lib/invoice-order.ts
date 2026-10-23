/**
 * Server-only: the order as the invoice, the invoice PDF and the order page
 * read it from Medusa. One place, so they all ask for the same fields.
 */
import "server-only";

import type { InvoiceOrder } from "@/lib/invoice-view";

const ADMIN_BASE = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

export const INVOICE_ORDER_FIELDS = [
  "id", "display_id", "customer_id", "email", "status", "metadata", "created_at", "currency_code",
  "subtotal", "item_subtotal", "discount_total", "shipping_total", "total", "credit_line_total", "credit_lines.reference", "credit_lines.amount",
  // "*items" on purpose: asking for items.quantity by name returns no
  // quantity, and Medusa then computes every total as zero.
  "*items",
  "*shipping_address",
  "promotions.code",
].join(",");

export async function fetchInvoiceOrder(orderId: string): Promise<InvoiceOrder | null> {
  const key = process.env.MEDUSA_ADMIN_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${ADMIN_BASE}/admin/orders/${encodeURIComponent(orderId)}?fields=${INVOICE_ORDER_FIELDS}`,
      { headers: { Authorization: `Basic ${key}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { order?: InvoiceOrder };
    return data.order ?? null;
  } catch {
    return null;
  }
}

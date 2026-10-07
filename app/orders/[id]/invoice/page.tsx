import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/current-user";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { storeConfig } from "@/config/storeConfig";
import { invoiceInfo } from "@/lib/invoice-kind";
import { InvoiceDocument, type MedusaOrder } from "@/components/orders/InvoiceDocument";
import { PrintButton } from "@/components/orders/PrintButton";

/* ── Data fetching ────────────────────────────────────────── */

const ADMIN_BASE = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

async function fetchOrder(orderId: string): Promise<MedusaOrder | null> {
  const key = process.env.MEDUSA_ADMIN_API_KEY;
  if (!key) return null;
  try {
    const fields = [
      "id", "display_id", "customer_id", "email", "status", "metadata", "created_at", "currency_code",
      "subtotal", "shipping_total", "total", "credit_line_total",
      // "*items" on purpose: asking for items.quantity by name returns no
      // quantity, and Medusa then computes every total as zero.
      "*items",
      "*shipping_address",
    ].join(",");
    const res = await fetch(`${ADMIN_BASE}/admin/orders/${orderId}?fields=${fields}`, {
      headers: { Authorization: `Basic ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { order?: MedusaOrder };
    return data.order ?? null;
  } catch {
    return null;
  }
}

/* ── Helpers ──────────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Invoice ${id.slice(0, 8).toUpperCase()}` };
}

/* ── Page ─────────────────────────────────────────────────── */

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const order = await fetchOrder(id);
  if (!order) notFound();

  const medusaCustomerId = user.publicMetadata?.medusaCustomerId as string | undefined;
  if (!medusaCustomerId || order.customer_id !== medusaCustomerId) notFound();

  const invoice = invoiceInfo(order.metadata);

  return (
    <div className="max-w-[800px] mx-auto px-6 lg:px-10 py-12">
      <div className="flex items-center justify-between mb-8 print:hidden">
        <Link
          href={`/orders/${order.id}`}
          className="font-sans text-[13px] text-[#909090] hover:text-black transition-colors duration-200"
        >
          ‹ Back to order
        </Link>
        <PrintButton />
      </div>

      {invoice.kind === "tax_invoice" && !storeConfig.seller.gstin && (
        <div className="mb-6 p-4 bg-[#FFFDF0] border border-[#E8D87A] rounded-2xl print:hidden">
          <p className="font-sans text-[13px] text-[#7A6200]">
            SELLER_GSTIN is not set. This invoice is missing a GST registration number and is not
            valid for compliance purposes until that&apos;s configured.
          </p>
        </div>
      )}

      <InvoiceDocument order={order} invoice={invoice} />
    </div>
  );
}

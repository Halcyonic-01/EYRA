import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/current-user";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { storeConfig } from "@/config/storeConfig";
import { invoiceInfo } from "@/lib/invoice-kind";
import { InvoiceDocument } from "@/components/orders/InvoiceDocument";
import { PrintButton } from "@/components/orders/PrintButton";
import { fetchInvoiceOrder } from "@/lib/invoice-order";
import { sellerIssues } from "@/lib/invoice-view";

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

  const order = await fetchInvoiceOrder(id);
  if (!order) notFound();

  const medusaCustomerId = user.publicMetadata?.medusaCustomerId as string | undefined;
  if (!medusaCustomerId || order.customer_id !== medusaCustomerId) notFound();

  const invoice = invoiceInfo(order.metadata);
  const issues = invoice.kind === "tax_invoice" ? sellerIssues(storeConfig.seller) : [];

  return (
    <div className="max-w-[800px] mx-auto px-6 lg:px-10 py-12">
      <div className="flex items-center justify-between mb-8 print:hidden">
        <Link
          href={`/orders/${order.id}`}
          className="font-sans text-[13px] text-[#909090] hover:text-black transition-colors duration-200"
        >
          ‹ Back to order
        </Link>
        <div className="flex items-center gap-4">
          {invoice.kind === "tax_invoice" && issues.length === 0 && (
            <a
              href={`/orders/${order.id}/invoice/pdf`}
              className="font-sans text-[13px] text-[#626262] underline underline-offset-2 hover:text-black transition-colors duration-200"
            >
              Download PDF
            </a>
          )}
          <PrintButton />
        </div>
      </div>

      {issues.length > 0 && (
        <div className="mb-6 p-4 bg-[#FFFDF0] border border-[#E8D87A] rounded-2xl print:hidden">
          {issues.map((issue) => (
            <p key={issue} className="font-sans text-[13px] text-[#7A6200]">
              {issue} It is not valid for compliance purposes until that&apos;s configured.
            </p>
          ))}
        </div>
      )}

      <InvoiceDocument order={order} invoice={invoice} />
    </div>
  );
}

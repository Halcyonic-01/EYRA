import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/current-user";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { storeConfig } from "@/config/storeConfig";
import { computeGst, gstStateCode } from "@/lib/gst";
import { formatRupees } from "@/lib/money";
import { PrintButton } from "@/components/orders/PrintButton";

/* ── Medusa types ─────────────────────────────────────────── */

interface MedusaOrderItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
}

interface MedusaShippingAddress {
  first_name: string | null;
  last_name: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  phone: string | null;
}

interface MedusaOrder {
  id: string;
  display_id: number;
  customer_id: string | null;
  email: string | null;
  created_at: string;
  currency_code: string;
  subtotal: number;
  shipping_total: number;
  total: number;
  /** Wallet credit used. It is a way of paying, so it never reduces the invoice value. */
  credit_line_total?: number;
  items: MedusaOrderItem[];
  shipping_address: MedusaShippingAddress | null;
}

/* ── Data fetching ────────────────────────────────────────── */

const ADMIN_BASE = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

async function fetchOrder(orderId: string): Promise<MedusaOrder | null> {
  const key = process.env.MEDUSA_ADMIN_API_KEY;
  if (!key) return null;
  try {
    const fields = [
      "id", "display_id", "customer_id", "email", "created_at", "currency_code",
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

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

  const seller = storeConfig.seller;
  const buyerState = order.shipping_address?.province ?? "";
  const gst = computeGst(order.subtotal, storeConfig.jewelry.gstRate, buyerState, seller.state);
  const walletCredit = order.credit_line_total ?? 0;

  const buyerName = [order.shipping_address?.first_name, order.shipping_address?.last_name]
    .filter(Boolean)
    .join(" ");

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

      {!seller.gstin && (
        <div className="mb-6 p-4 bg-[#FFFDF0] border border-[#E8D87A] rounded-2xl print:hidden">
          <p className="font-sans text-[13px] text-[#7A6200]">
            SELLER_GSTIN is not set. This invoice is missing a GST registration number and is not
            valid for compliance purposes until that&apos;s configured.
          </p>
        </div>
      )}

      <div className="border border-[#E1E1E1] rounded-2xl p-8 lg:p-12">
        {/* Header */}
        <div className="flex justify-between items-start gap-6 mb-8 pb-8 border-b border-[#E1E1E1]">
          <div>
            <Image
              src="/images/logo-mark-black.png"
              alt="EYRA"
              width={112}
              height={65}
              priority
              className="mb-3 h-[65px] w-auto"
            />
            <p className="font-sans text-[13px] text-[#626262] leading-[20px]">
              {seller.legalName}
              <br />
              {[seller.addressLine1, seller.addressLine2].filter(Boolean).join(", ")}
              <br />
              {seller.city}, {seller.state} {seller.pincode}
              <br />
              GSTIN: {seller.gstin || "-"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-sans font-medium text-[18px] text-black uppercase tracking-wide">
              Tax Invoice
            </p>
            <p className="font-sans text-[13px] text-[#626262] mt-2">
              Invoice #: INV-{order.display_id}
              <br />
              Order #: {order.display_id}
              <br />
              Date: {formatDate(order.created_at)}
            </p>
          </div>
        </div>

        {/* Bill to / Place of supply */}
        <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-[#E1E1E1]">
          <div>
            <p className="font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] mb-2">
              Bill To
            </p>
            <p className="font-sans text-[14px] text-black leading-[22px]">
              {buyerName || order.email}
              <br />
              {order.shipping_address?.address_1}
              {order.shipping_address?.address_2 ? `, ${order.shipping_address.address_2}` : ""}
              <br />
              {order.shipping_address?.city}, {order.shipping_address?.province}{" "}
              {order.shipping_address?.postal_code}
              <br />
              {order.email}
            </p>
          </div>
          <div>
            <p className="font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] mb-2">
              Place of Supply
            </p>
            <p className="font-sans text-[14px] text-black leading-[22px]">
              {buyerState || "-"} ({gstStateCode(buyerState)})
            </p>
            <p className="font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] mt-4 mb-2">
              Tax Type
            </p>
            <p className="font-sans text-[14px] text-black">
              {gst.isInterState ? "IGST (inter-state)" : "CGST + SGST (intra-state)"}
            </p>
          </div>
        </div>

        {/* Line items */}
        <table className="w-full mb-8 border-collapse">
          <thead>
            <tr className="border-b border-[#E1E1E1]">
              <th className="text-left font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
                Description
              </th>
              <th className="text-left font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
                HSN
              </th>
              <th className="text-right font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
                Qty
              </th>
              <th className="text-right font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
                Unit Price
                <span className="block normal-case tracking-normal text-[10px] font-normal">incl. all taxes</span>
              </th>
              <th className="text-right font-sans font-medium text-[11px] uppercase tracking-wide text-[#909090] pb-3">
                Amount
                <span className="block normal-case tracking-normal text-[10px] font-normal">incl. all taxes</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-[#F0F0F0]">
                <td className="py-3 font-sans text-[14px] text-black">{item.title}</td>
                <td className="py-3 font-sans text-[14px] text-[#626262]">
                  {storeConfig.jewelry.hsnCode}
                </td>
                <td className="py-3 font-sans text-[14px] text-black text-right">{item.quantity}</td>
                <td className="py-3 font-sans text-[14px] text-black text-right">
                  {formatAmount(item.unit_price)}
                </td>
                <td className="py-3 font-sans text-[14px] text-black text-right">
                  {formatAmount(item.unit_price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-[280px] flex flex-col gap-2">
            <div className="flex justify-between font-sans text-[14px]">
              <span className="text-[#626262]">Taxable Value</span>
              <span className="text-black">{formatAmount(order.subtotal)}</span>
            </div>
            {gst.isInterState ? (
              <div className="flex justify-between font-sans text-[14px]">
                <span className="text-[#626262]">IGST ({gst.rate}%)</span>
                <span className="text-black">{formatAmount(gst.igst)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between font-sans text-[14px]">
                  <span className="text-[#626262]">CGST ({gst.rate}%)</span>
                  <span className="text-black">{formatAmount(gst.cgst)}</span>
                </div>
                <div className="flex justify-between font-sans text-[14px]">
                  <span className="text-[#626262]">SGST ({gst.rate}%)</span>
                  <span className="text-black">{formatAmount(gst.sgst)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-sans text-[14px]">
              <span className="text-[#626262]">Shipping</span>
              <span className="text-black">{formatAmount(order.shipping_total)}</span>
            </div>
            <div className="h-px bg-[#E1E1E1] my-1" />
            <div className="flex justify-between font-sans font-medium text-[16px]">
              <span className="text-black">{walletCredit > 0 ? "Invoice Total" : "Total"}</span>
              <span className="text-black">{formatAmount(order.total + walletCredit)}</span>
            </div>
            <p className="text-right font-sans text-[11px] text-[#909090] -mt-1">Inclusive of all taxes</p>
            {walletCredit > 0 && (
              <>
                <div className="flex justify-between font-sans text-[14px]">
                  <span className="text-[#626262]">Paid with wallet credit</span>
                  <span className="text-black">− {formatRupees(walletCredit)}</span>
                </div>
                <div className="flex justify-between font-sans font-medium text-[14px]">
                  <span className="text-black">Balance payable</span>
                  <span className="text-black">{formatAmount(order.total)}</span>
                </div>
                <p className="text-right font-sans text-[11px] text-[#909090] -mt-1">Inclusive of all taxes</p>
              </>
            )}
          </div>
        </div>

        <p className="font-sans text-[11px] text-[#909090] mt-10 pt-6 border-t border-[#E1E1E1]">
          This is a computer-generated invoice and does not require a signature.
        </p>
      </div>
    </div>
  );
}

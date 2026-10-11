import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/current-user";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata: Metadata = {
  title: "My Orders",
  description: "View your EYRA order history.",
};

/* ── Medusa Admin API types ───────────────────────────────── */

interface MedusaOrderItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  thumbnail: string | null;
}

interface MedusaOrder {
  id: string;
  display_id: number;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  total: number;
  currency_code: string;
  created_at: string;
  items: MedusaOrderItem[];
  metadata?: {
    shiprocket_shipment_id?: string;
    awb_code?: string;
    courier_name?: string;
  };
}

/* ── Data fetching ────────────────────────────────────────── */

async function fetchCustomerOrders(medusaCustomerId: string): Promise<MedusaOrder[]> {
  const base = (
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
  ).replace(/\/$/, "");
  const key = process.env.MEDUSA_ADMIN_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch(
      `${base}/admin/orders?customer_id=${encodeURIComponent(medusaCustomerId)}&limit=20&order=-created_at`,
      {
        // Secret API keys (sk_...) authenticate via HTTP Basic, not this header.
        headers: { Authorization: `Basic ${key}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return [];
    const data = await res.json() as { orders?: MedusaOrder[] };
    return data.orders ?? [];
  } catch {
    return [];
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

/** Medusa v2 returns order amounts in rupees, not paise. */
function formatAmount(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
  requires_action: "Action Required",
};

const FULFILLMENT_LABEL: Record<string, string> = {
  not_fulfilled: "Processing",
  partially_fulfilled: "Partially Shipped",
  fulfilled: "Shipped",
  partially_shipped: "Partially Shipped",
  shipped: "Shipped",
  partially_delivered: "Partially Delivered",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  const colours: Record<string, string> = {
    completed: "bg-[#F0FBE8] text-[#3D7A1A] border-[#C8EEB8]",
    cancelled: "bg-[#FFF0F0] text-[#B91C1C] border-[#FECACA]",
    requires_action: "bg-[#FFFDF0] text-[#7A6200] border-[#E8D87A]",
    pending: "bg-[#F7F7F7] text-[#626262] border-[#E1E1E1]",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-medium font-sans ${colours[status] ?? colours.pending}`}
    >
      {label}
    </span>
  );
}

function FulfillmentBadge({ status }: { status: string }) {
  const label = FULFILLMENT_LABEL[status] ?? status;
  const isDone = ["shipped", "fulfilled", "delivered"].includes(status);
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-sans ${isDone ? "text-[#3D7A1A]" : "text-[#626262]"}`}
    >
      {isDone && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
      {label}
    </span>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const medusaCustomerId = user.publicMetadata?.medusaCustomerId as string | undefined;
  const orders = medusaCustomerId ? await fetchCustomerOrders(medusaCustomerId) : [];

  return (
    <div className="max-w-screen-lg mx-auto px-6 lg:px-10 py-12">

      {/* Header */}
      <div className="mb-8">
        <p className="font-sans font-light tracking-[0.3em] uppercase text-[0.78rem] text-[#909090] mb-1">
          Account
        </p>
        <h1 className="font-sans font-medium text-[26px] text-black">My Orders</h1>
      </div>

      {orders.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center gap-6 py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#F7F7F7] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CFCFCF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div>
            <p className="font-sans font-medium text-[18px] text-black mb-1">No orders yet</p>
            <p className="font-sans font-normal text-[14px] text-[#909090]">
              Your completed orders will appear here.
            </p>
          </div>
          <Link
            href="/products"
            className="px-8 py-3.5 bg-black text-white font-sans font-medium text-[14px] rounded-full hover:bg-[#1a1a1a] transition-colors duration-200"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const hasTracking = !!order.metadata?.awb_code;
            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="group block rounded-2xl border border-[#E1E1E1] bg-white hover:border-[#AAAAAA] transition-colors duration-200 overflow-hidden"
              >
                {/* Order header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-[#F0F0F0]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-sans font-medium text-[15px] text-black">
                      #{order.display_id}
                    </span>
                    <StatusBadge status={order.status} />
                    <FulfillmentBadge status={order.fulfillment_status} />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-sans font-normal text-[13px] text-[#909090]">
                      {formatDate(order.created_at)}
                    </span>
                    <span className="font-sans font-semibold text-[16px] text-black">
                      {formatAmount(order.total)}
                    </span>
                    <svg
                      className="flex-shrink-0 text-[#CFCFCF] group-hover:text-black transition-colors duration-200"
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>

                {/* Items preview */}
                <div className="px-6 py-4 flex items-center justify-between gap-4">
                  <p className="font-sans font-normal text-[13px] text-[#626262] truncate">
                    {order.items?.map((i) => `${i.title} ×${i.quantity}`).join(", ")}
                  </p>
                  {hasTracking && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F0FBE8] border border-[#C8EEB8] font-sans text-[11px] text-[#3D7A1A] font-medium">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                      </svg>
                      Track
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Footer nav */}
      <div className="mt-10 pt-6 border-t border-[#F0F0F0] flex gap-6">
        <Link href="/account" className="font-sans text-[13px] text-[#626262] hover:text-black transition-colors duration-200">
          Account Settings
        </Link>
        <Link href="/products" className="font-sans text-[13px] text-[#626262] hover:text-black transition-colors duration-200">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

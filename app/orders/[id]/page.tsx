import type { Metadata } from "next";
import { formatRupees } from "@/lib/money";
import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { storeConfig } from "@/config/storeConfig";
import { listReturnRequests } from "@/lib/medusa-returns";
import { eligibility, reasonLabel, STATUS_LABELS, type ReturnRequestStatus } from "@/lib/return-requests";

/* ── Medusa types ─────────────────────────────────────────── */

interface MedusaOrderItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  total: number;
  thumbnail: string | null;
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
  status: string;
  payment_status: string;
  fulfillment_status: string;
  total: number;
  subtotal: number;
  tax_total: number;
  shipping_total: number;
  /** Wallet credit used on this order; `total` is already net of it. */
  credit_line_total?: number;
  currency_code: string;
  created_at: string;
  items: MedusaOrderItem[];
  shipping_address: MedusaShippingAddress | null;
  metadata?: {
    shiprocket_shipment_id?: string;
    awb_code?: string;
    courier_name?: string;
  };
}

/* ── Shiprocket tracking types ────────────────────────────── */

interface TrackActivity {
  date: string;
  status: string;
  activity: string;
  location: string;
}

interface ShiprocketTrackingResponse {
  tracking_data?: {
    track_status: number;
    shipment_status: number;
    shipment_track?: Array<{
      current_status: string;
      courier_name: string;
      awb_code: string;
    }>;
    shipment_track_activities?: TrackActivity[];
  };
}

/* ── Data fetching ────────────────────────────────────────── */

const ADMIN_BASE = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

async function fetchOrder(orderId: string): Promise<MedusaOrder | null> {
  const key = process.env.MEDUSA_ADMIN_API_KEY;
  if (!key) return null;
  try {
    // customer_id isn't in Medusa's default retrieve fields, request it
    // explicitly so ownership can be verified before rendering the order.
    const res = await fetch(`${ADMIN_BASE}/admin/orders/${orderId}?fields=+customer_id,+credit_line_total`, {
      // Secret API keys (sk_...) authenticate via HTTP Basic, not this header.
      headers: { Authorization: `Basic ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json() as { order?: MedusaOrder };
    return data.order ?? null;
  } catch {
    return null;
  }
}

async function fetchTracking(awbCode: string): Promise<TrackActivity[]> {
  const token = process.env.SHIPROCKET_API_TOKEN;
  if (!token) return [];
  try {
    const res = await fetch(
      `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${encodeURIComponent(awbCode)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return [];
    const data = await res.json() as ShiprocketTrackingResponse;
    return data.tracking_data?.shipment_track_activities ?? [];
  } catch {
    return [];
  }
}

/* ── Metadata ─────────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id.slice(0, 8).toUpperCase()}` };
}

/* ── Helpers ──────────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Medusa v2 returns order amounts in rupees, not paise. */
function formatAmount(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

type TrackStep = {
  label: string;
  key: string[];
};

const ORDERED_STEPS: TrackStep[] = [
  { label: "Order Placed",      key: ["order placed", "new", "pending"] },
  { label: "Pickup Scheduled",  key: ["pickup scheduled", "pickup generated", "pickup queued"] },
  { label: "Picked Up",         key: ["picked up", "out for pickup", "in transit"] },
  { label: "Shipped",           key: ["shipped", "dispatched", "reached hub", "hub"] },
  { label: "Out for Delivery",  key: ["out for delivery"] },
  { label: "Delivered",         key: ["delivered"] },
];

function detectStep(text: string): number {
  const lower = text.toLowerCase();
  for (let i = ORDERED_STEPS.length - 1; i >= 0; i--) {
    if (ORDERED_STEPS[i].key.some((k) => lower.includes(k))) return i;
  }
  return 0;
}

function TrackingTimeline({
  activities,
  awbCode,
  courierName,
}: {
  activities: TrackActivity[];
  awbCode: string;
  courierName?: string;
}) {
  // Determine how far along the canonical steps we are
  const latestStep = activities.length > 0
    ? Math.max(...activities.map((a) => detectStep(a.status ?? a.activity)))
    : 0;

  return (
    <div className="rounded-2xl border border-[#E1E1E1] overflow-hidden">
      {/* Header */}
      <div className="bg-[#F7F7F7] px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <p className="font-sans font-medium text-[12px] text-[#626262] uppercase tracking-wider">
          Shipment Tracking
        </p>
        <div className="flex items-center gap-3">
          {courierName && (
            <span className="font-sans text-[12px] text-[#626262]">{courierName}</span>
          )}
          <span className="font-mono text-[12px] text-black font-medium">{awbCode}</span>
        </div>
      </div>

      {/* Canonical step progress bar */}
      <div className="px-5 py-5 border-b border-[#F0F0F0]">
        <div className="flex items-start gap-0">
          {ORDERED_STEPS.map((step, i) => {
            const done = i <= latestStep;
            const active = i === latestStep;
            const isLast = i === ORDERED_STEPS.length - 1;
            return (
              <div key={step.label} className="flex-1 flex flex-col items-center gap-1.5 relative">
                {/* Connector line before this dot (except first) */}
                {i > 0 && (
                  <div
                    className={`absolute left-0 top-[10px] w-1/2 h-[2px] -translate-x-0 ${
                      done ? "bg-black" : "bg-[#E1E1E1]"
                    }`}
                    style={{ right: "50%", left: "0" }}
                  />
                )}
                {/* Connector line after this dot (except last) */}
                {!isLast && (
                  <div
                    className={`absolute top-[10px] h-[2px] ${i < latestStep ? "bg-black" : "bg-[#E1E1E1]"}`}
                    style={{ left: "50%", right: "0" }}
                  />
                )}
                {/* Dot */}
                <div
                  className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                    done
                      ? active
                        ? "bg-black ring-4 ring-black/10"
                        : "bg-black"
                      : "bg-white border-2 border-[#CFCFCF]"
                  }`}
                >
                  {done && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-center font-sans text-[10px] leading-tight ${
                    active ? "text-black font-medium" : done ? "text-[#626262]" : "text-[#CFCFCF]"
                  }`}
                  style={{ maxWidth: 60 }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed activity log */}
      {activities.length > 0 ? (
        <div className="divide-y divide-[#F7F7F7]">
          {[...activities].reverse().map((a, i) => (
            <div key={i} className="flex gap-4 px-5 py-3.5">
              <div className="flex-shrink-0 w-1.5 flex flex-col items-center pt-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#909090]" />
                {i < activities.length - 1 && (
                  <div className="w-px flex-1 bg-[#E1E1E1] mt-1" />
                )}
              </div>
              <div className="flex-1 pb-1">
                <p className="font-sans font-medium text-[13px] text-black">
                  {a.activity || a.status}
                </p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {a.location && (
                    <span className="font-sans text-[11px] text-[#909090]">{a.location}</span>
                  )}
                  <span className="font-sans text-[11px] text-[#AAAAAA]">{a.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-6 text-center">
          <p className="font-sans text-[13px] text-[#909090]">
            Tracking details will appear once the parcel is handed to the courier.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const order = await fetchOrder(id);
  if (!order) notFound();

  // Ownership check, fetchOrder uses the Admin API, which will happily
  // return any order regardless of who's asking. Without this, any signed-in
  // user could view any other customer's order (items, address, phone) just
  // by guessing or enumerating order IDs.
  const medusaCustomerId = user.publicMetadata?.medusaCustomerId as string | undefined;
  if (!medusaCustomerId || order.customer_id !== medusaCustomerId) notFound();

  const awbCode = order.metadata?.awb_code;
  const courierName = order.metadata?.courier_name;
  const activities = awbCode ? await fetchTracking(awbCode) : [];

  const requests = (await listReturnRequests(medusaCustomerId, order.id)) ?? [];
  const requestability = eligibility(order, storeConfig.policy);
  const canRequest = !requestability.closedReason;

  const fullName = [
    order.shipping_address?.first_name,
    order.shipping_address?.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="max-w-screen-lg mx-auto px-6 lg:px-10 py-12">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8 font-sans text-[13px]">
        <Link href="/orders" className="text-[#909090] hover:text-black transition-colors duration-200">
          My Orders
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#CFCFCF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-black font-medium">#{order.display_id}</span>
      </div>

      {/* Order title + status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <div>
          <p className="font-sans font-light tracking-[0.3em] uppercase text-[0.78rem] text-[#909090] mb-0.5">
            Order
          </p>
          <h1 className="font-sans font-medium text-[24px] text-black">
            #{order.display_id}
          </h1>
          <p className="font-sans text-[13px] text-[#909090] mt-0.5">
            Placed {formatDate(order.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-sans font-semibold text-[22px] text-black">
            {formatAmount(order.total)}
          </span>
          <Link
            href={`/orders/${order.id}/invoice`}
            className="font-sans text-[13px] text-black underline underline-offset-2 hover:text-[#626262] transition-colors duration-200"
          >
            View Invoice
          </Link>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* Left column */}
        <div className="flex-1 flex flex-col gap-6">

          {/* Tracking timeline, only when AWB exists */}
          {awbCode && (
            <TrackingTimeline
              activities={activities}
              awbCode={awbCode}
              courierName={courierName}
            />
          )}

          {/* Returns and exchanges */}
          {(requests.length > 0 || canRequest) && (
            <div className="rounded-2xl border border-[#E1E1E1] overflow-hidden">
              <div className="bg-[#F7F7F7] px-5 py-3 flex items-center justify-between gap-3">
                <p className="font-sans font-medium text-[12px] text-[#626262] uppercase tracking-wider">
                  Returns and exchanges
                </p>
                {canRequest && (
                  <Link
                    href={`/orders/${order.id}/return`}
                    className="font-sans text-[12px] text-black underline underline-offset-2 hover:text-[#626262] transition-colors duration-200"
                  >
                    Request a return or exchange
                  </Link>
                )}
              </div>
              {requests.length === 0 ? (
                <p className="px-5 py-4 font-sans text-[13px] text-[#909090]">
                  No requests for this order yet.
                </p>
              ) : (
                <div className="divide-y divide-[#F5F5F5]">
                  {requests.map((request) => (
                    <div key={request.id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-sans text-[14px] text-black capitalize">
                          {request.type} · {reasonLabel(request.reason)}
                        </p>
                        <span
                          className={`rounded-full px-3 py-1 font-sans text-[11px] ${
                            request.status === "approved"
                              ? "bg-[#E8F7DD] text-[#2F7A06]"
                              : request.status === "rejected"
                              ? "bg-[#FFF1F1] text-[#B42318]"
                              : "bg-[#F0F0F0] text-[#626262]"
                          }`}
                        >
                          {STATUS_LABELS[request.status as ReturnRequestStatus]}
                        </span>
                      </div>
                      <p className="mt-1 font-sans text-[12px] text-[#909090]">
                        {request.items.map((item) => `${item.quantity} × ${item.title}`).join(", ")}
                      </p>
                      {request.status === "approved" && request.creditAmount ? (
                        <p className="mt-1 font-sans text-[12px] text-[#2F7A06]">
                          {formatRupees(request.creditAmount)} added to your wallet.
                        </p>
                      ) : null}
                      {request.resolutionNote && (
                        <p className="mt-1 font-sans text-[12px] text-[#626262]">{request.resolutionNote}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Order items */}
          <div className="rounded-2xl border border-[#E1E1E1] overflow-hidden">
            <div className="bg-[#F7F7F7] px-5 py-3">
              <p className="font-sans font-medium text-[12px] text-[#626262] uppercase tracking-wider">
                Items ({order.items?.length ?? 0})
              </p>
            </div>
            <div className="divide-y divide-[#F5F5F5]">
              {order.items?.map((item) => (
                <div key={item.id} className="flex gap-4 px-5 py-4 items-center">
                  {item.thumbnail ? (
                    <div className="relative w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden bg-[#F9F9F9] border border-[#E1E1E1]">
                      <Image
                        src={item.thumbnail}
                        alt={item.title}
                        fill
                        className="object-contain p-1.5"
                        sizes="56px"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 flex-shrink-0 rounded-xl bg-[#F0F0F0] flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CFCFCF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-sans font-normal text-[14px] text-black truncate">
                      {item.title}
                    </p>
                    <p className="font-sans text-[12px] text-[#909090] mt-0.5">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <span className="font-sans font-medium text-[14px] text-black flex-shrink-0">
                    {formatAmount(item.unit_price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column, order summary */}
        <div className="lg:w-[300px] flex flex-col gap-5">

          {/* Price breakdown */}
          <div className="rounded-2xl border border-[#E1E1E1] overflow-hidden">
            <div className="bg-[#F7F7F7] px-5 py-3">
              <p className="font-sans font-medium text-[12px] text-[#626262] uppercase tracking-wider">
                Price Summary
              </p>
            </div>
            <div className="px-5 py-4 flex flex-col gap-2.5 font-sans text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#626262]">Subtotal</span>
                <span className="text-black">{formatAmount(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#626262]">Tax</span>
                <span className="text-black">{formatAmount(order.tax_total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#626262]">Shipping</span>
                {order.shipping_total === 0
                  ? <span className="font-medium" style={{ color: "#47B10A" }}>FREE</span>
                  : <span className="text-black">{formatAmount(order.shipping_total)}</span>}
              </div>
              {(order.credit_line_total ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#626262]">Wallet credit</span>
                  <span className="font-medium" style={{ color: "#47B10A" }}>− {formatRupees(order.credit_line_total ?? 0)}</span>
                </div>
              )}
              <div className="h-px bg-[#F0F0F0] my-0.5" />
              <div className="flex justify-between">
                <span className="font-semibold text-black">Total</span>
                <span className="font-semibold text-[16px] text-black">{formatAmount(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Shipping address */}
          {order.shipping_address && (
            <div className="rounded-2xl border border-[#E1E1E1] overflow-hidden">
              <div className="bg-[#F7F7F7] px-5 py-3">
                <p className="font-sans font-medium text-[12px] text-[#626262] uppercase tracking-wider">
                  Delivery Address
                </p>
              </div>
              <div className="px-5 py-4 font-sans text-[13px] text-[#626262] leading-relaxed">
                {fullName && <p className="text-black font-medium">{fullName}</p>}
                {order.shipping_address.address_1 && <p>{order.shipping_address.address_1}</p>}
                {order.shipping_address.address_2 && <p>{order.shipping_address.address_2}</p>}
                <p>
                  {[
                    order.shipping_address.city,
                    order.shipping_address.province,
                    order.shipping_address.postal_code,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {order.shipping_address.phone && (
                  <p className="mt-1.5">{order.shipping_address.phone}</p>
                )}
              </div>
            </div>
          )}

          {/* AWB chip when no full timeline */}
          {awbCode && activities.length === 0 && (
            <div className="rounded-2xl border border-[#E1E1E1] px-5 py-4">
              <p className="font-sans font-medium text-[12px] text-[#626262] uppercase tracking-wider mb-2">
                AWB / Tracking No.
              </p>
              <p className="font-mono font-medium text-[14px] text-black">{awbCode}</p>
              {courierName && (
                <p className="font-sans text-[12px] text-[#909090] mt-0.5">via {courierName}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Back link */}
      <div className="mt-10 pt-6 border-t border-[#F0F0F0]">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 font-sans text-[13px] text-[#626262] hover:text-black transition-colors duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to Orders
        </Link>
      </div>
    </div>
  );
}

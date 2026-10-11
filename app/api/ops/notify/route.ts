import type { NextRequest } from "next/server";

import { checkInternalRequest } from "@/lib/internal-auth";
import { cancelReasonLabel } from "@/lib/cancellation";
import {
  sendOpsAlert,
  sendOrderCancelledNotice,
  sendOrderHeldNotification,
  type OrderHeldNotice,
} from "@/lib/ops-alert";

const MEDUSA_BASE = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

interface NotifyBody {
  type?: string;
  order_id?: string;
  order_ref?: string | null;
  // order_held
  cancel_until?: string;
  window_minutes?: number;
  // dispatch_failed
  attempts?: number;
  max_attempts?: number;
  will_retry?: boolean;
  error?: string;
  // cancelled_after_shipment, shipment_orphaned
  state?: string | null;
  shipment_id?: string | null;
  awb_code?: string | null;
  // cancellation_stalled
  detail?: string;
  // refund_missing_after_cancel
  amount?: number | null;
  refunded?: number | null;
  checked?: boolean;
  // order_cancelled
  method?: "wallet" | "original" | "none";
  paid_online?: number;
  refund_amount?: number;
  fee?: number;
  wallet_used?: number;
  reason?: string | null;
  note?: string | null;
  refund_status?: string;
  status?: string;
  refund_error?: string | null;
}

interface RawOrder {
  id: string;
  display_id?: number;
  email?: string | null;
  total?: number | string;
  items?: {
    title?: string | null;
    product_title?: string | null;
    variant_sku?: string | null;
    quantity?: number | string;
    detail?: { quantity?: number | string } | null;
  }[];
  shipping_address?: {
    first_name?: string | null;
    last_name?: string | null;
    address_1?: string | null;
    address_2?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
    phone?: string | null;
  } | null;
  payment_collections?: { payments?: { provider_id?: string | null }[] }[];
}

async function fetchOrder(orderId: string): Promise<RawOrder | null> {
  const key = process.env.MEDUSA_ADMIN_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${MEDUSA_BASE}/admin/orders/${encodeURIComponent(orderId)}?fields=%2Bdisplay_id,%2Btotal,*items,*shipping_address,*payment_collections,*payment_collections.payments`,
      { headers: { Authorization: `Basic ${key}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    return ((await res.json()) as { order?: RawOrder }).order ?? null;
  } catch (err) {
    console.error("[ops/notify] could not read order", orderId, ":", err);
    return null;
  }
}

function describeOrder(order: RawOrder | null, ref: string | null | undefined, orderId: string): string {
  if (ref) return ref;
  if (order?.display_id) return `EYRA-${order.display_id}`;
  return orderId;
}

/**
 * Called by the Medusa backend when the team needs to know something about an
 * order's shipping: a new order is being held, a shipment could not be created,
 * or an order was cancelled after its shipment existed. It sends the email; it
 * does not decide whether to.
 *
 * Authenticated with the secret the backend already shares with the storefront.
 */
export async function POST(req: NextRequest) {
  const auth = checkInternalRequest(req);
  if (auth === "unconfigured") {
    return Response.json({ error: "Notifications are not configured." }, { status: 503 });
  }
  if (auth === "unauthorized") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: NotifyBody;
  try {
    body = (await req.json()) as NotifyBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const orderId = body.order_id;
  if (typeof orderId !== "string" || !orderId.startsWith("order_")) {
    return Response.json({ error: "order_id is required." }, { status: 400 });
  }

  if (body.type === "order_held") {
    const cancelUntil = body.cancel_until ? new Date(body.cancel_until) : null;
    if (!cancelUntil || Number.isNaN(cancelUntil.getTime())) {
      return Response.json({ error: "cancel_until must be a date." }, { status: 400 });
    }

    const order = await fetchOrder(orderId);
    if (!order) {
      return Response.json({ error: "The order could not be read." }, { status: 502 });
    }

    const address = order.shipping_address;
    const notice: OrderHeldNotice = {
      orderRef: describeOrder(order, null, orderId),
      medusaOrderId: orderId,
      paymentMethod: (order.payment_collections ?? []).some((pc) =>
        (pc.payments ?? []).some((p) => (p.provider_id ?? "").includes("razorpay"))
      )
        ? "prepaid"
        : Number(order.total) > 0
        ? "cod"
        : "prepaid",
      total: Number(order.total) || 0,
      items: (order.items ?? []).map((item) => ({
        name: item.product_title || item.title || "Item",
        sku: item.variant_sku || item.title || "",
        quantity: Number(item.detail?.quantity ?? item.quantity) || 1,
      })),
      shipping: address
        ? {
            fullName: [address.first_name, address.last_name].filter(Boolean).join(" "),
            addressLine1: address.address_1 ?? "",
            addressLine2: address.address_2 ?? undefined,
            city: address.city ?? "",
            state: address.province ?? "",
            pincode: address.postal_code ?? "",
            phone: address.phone ?? "",
          }
        : null,
      cancelUntil,
      adminUrl: `${MEDUSA_BASE}/app/orders/${orderId}`,
    };
    await sendOrderHeldNotification(notice);
    return Response.json({ received: true });
  }

  if (body.type === "dispatch_failed") {
    const ref = describeOrder(null, body.order_ref, orderId);
    const attempts = Number(body.attempts) || 0;
    const max = Number(body.max_attempts) || 0;
    await sendOpsAlert(`Shipment could not be created: order ${ref}`, [
      `Medusa order: ${orderId}`,
      `Attempt ${attempts}${max ? ` of ${max}` : ""} failed: ${String(body.error ?? "unknown error").slice(0, 300)}`,
      body.will_retry
        ? "It will be retried automatically."
        : "It will not be retried again. Open the order in Medusa admin and click Try again now, or create the shipment in the Shiprocket dashboard.",
    ]);
    return Response.json({ received: true });
  }

  if (body.type === "cancelled_after_shipment") {
    await sendOpsAlert(`Order cancelled after its shipment was created: ${orderId}`, [
      `Medusa order: ${orderId}`,
      `Shipping state when it was cancelled: ${body.state ?? "unknown"}`,
      "The parcel may already be with the courier. Cancel the shipment in the Shiprocket dashboard, or stop the parcel before it leaves.",
    ]);
    return Response.json({ received: true });
  }

  if (body.type === "order_cancelled") {
    await sendOrderCancelledNotice({
      orderRef: describeOrder(null, body.order_ref, orderId),
      medusaOrderId: orderId,
      method: body.method ?? "none",
      paidOnline: Number(body.paid_online) || 0,
      refundAmount: Number(body.refund_amount) || 0,
      fee: Number(body.fee) || 0,
      walletUsed: Number(body.wallet_used) || 0,
      reasonLabel: cancelReasonLabel(body.reason),
      note: body.note ?? null,
      refundStatus: body.refund_status ?? "unknown",
      needsAttention: body.status === "needs_attention" || body.refund_status === "failed" || body.refund_status === "unverified",
      refundError: body.refund_error ?? null,
      adminUrl: `${MEDUSA_BASE}/app/orders/${orderId}`,
    });
    return Response.json({ received: true });
  }

  if (body.type === "cancellation_stalled") {
    await sendOpsAlert(`A cancellation was interrupted: order ${orderId}`, [
      `Medusa order: ${orderId}`,
      "A customer's cancellation started but did not finish. Money may or may not have moved.",
      ...(body.detail ? [String(body.detail).slice(0, 300)] : []),
      "The order is held and will not ship. Open it in Medusa admin, check the payment in Razorpay, then use Retry refund: it sends nothing if the refund already exists.",
    ]);
    return Response.json({ received: true });
  }

  if (body.type === "shipment_orphaned") {
    const ref = describeOrder(null, body.order_ref, orderId);
    await sendOpsAlert(`Shipment created for an order that had moved on: ${ref}`, [
      `Medusa order: ${orderId}`,
      `Shipping state now: ${body.state ?? "unknown"}`,
      `Shiprocket shipment: ${body.shipment_id ?? "(unknown)"}, AWB: ${body.awb_code ?? "(none)"}`,
      "This shipment may be a duplicate, or for a cancelled order. Check the order in Shiprocket and cancel this shipment there if it is not wanted.",
    ]);
    return Response.json({ received: true });
  }

  if (body.type === "refund_missing_after_cancel") {
    const ref = describeOrder(null, body.order_ref, orderId);
    await sendOpsAlert(`Cancelled order may not have been refunded: ${ref}`, [
      `Medusa order: ${orderId}`,
      body.checked
        ? `Razorpay shows ${body.refunded ?? 0} refunded of ${body.amount ?? "?"} paid.`
        : "Razorpay could not be checked, so the refund could not be confirmed.",
      "The order was cancelled in Medusa admin. Open the payment in the Razorpay dashboard and refund what is still owed to the customer.",
    ]);
    return Response.json({ received: true });
  }

  if (body.type === "payment_not_captured") {
    const ref = describeOrder(null, body.order_ref, orderId);
    await sendOpsAlert(`Payment not recorded as captured in Medusa: order ${ref}`, [
      `Medusa order: ${orderId}`,
      "The customer paid through Razorpay but Medusa still shows the payment as authorised only.",
      "Check that the Razorpay webhook for payment.captured points to Medusa (/hooks/payment/razorpay_razorpay). Until it does, the customer cannot cancel this order and Cancel in Medusa admin will fail.",
    ]);
    return Response.json({ received: true });
  }

  if (body.type === "dispatch_not_started") {
    await sendOpsAlert(`Shipping could not be started for order ${orderId}`, [
      `Medusa order: ${orderId}`,
      `Error: ${String(body.error ?? "unknown error").slice(0, 300)}`,
      "The dispatch job retries this within a few minutes and emails you again when it does. If no second email arrives, open the order in Medusa admin and use Ship now.",
    ]);
    return Response.json({ received: true });
  }

  if (body.type === "dispatch_recovered") {
    const ref = describeOrder(null, body.order_ref, orderId);
    const until = body.cancel_until ? new Date(body.cancel_until) : null;
    await sendOpsAlert(`Order ${ref} was added to shipping late`, [
      `Medusa order: ${orderId}`,
      "This order had no shipping record, so it would never have shipped. One has now been created.",
      until && !Number.isNaN(until.getTime())
        ? `The customer can still cancel until ${until.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}; it ships after that.`
        : "Its shipment is being created now.",
    ]);
    return Response.json({ received: true });
  }

  return Response.json({ error: "Unknown notification type." }, { status: 400 });
}

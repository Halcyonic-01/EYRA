import type { NextRequest } from "next/server";
import { storeConfig } from "@/config/storeConfig";
import { rememberOrderForShipment } from "@/lib/shiprocket-store";
import { splitName } from "@/lib/medusa-order";
import { applyRateLimit } from "@/lib/rateLimit";
import { sendOpsAlert, sendOrderPlacedNotification } from "@/lib/ops-alert";

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";
const MEDUSA_BASE = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

/* ── Request / Response types ─────────────────────────────── */

export interface ShipmentItem {
  name: string;
  sku: string;
  type: string;       // "ring" | "chain" | "bracelet" | "anklet"
  quantity: number;
  price: number;      // unit price in rupees
}

export interface ShipmentAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
}

export interface CreateShipmentBody {
  medusaOrderId?: string;
  eyraOrderRef: string;
  paymentMethod: "prepaid" | "cod";
  shipping: ShipmentAddress;
  items: ShipmentItem[];
  subtotal: number;   // in rupees
}

export interface CreateShipmentResult {
  success: boolean;
  shipmentId: string | null;
  awbCode: string | null;
  courierName: string | null;
  labelUrl: string | null;
  error?: string;
  /** Non-fatal diagnostic, shipment was created but a background step failed (e.g. Medusa metadata write). */
  warning?: string;
}

interface ShiprocketOrderResponse {
  order_id?: number;
  shipment_id?: number;
  status?: string;
  status_code?: number;
  awb_code?: string;
  courier_company_id?: number;
  courier_name?: string;
  message?: string;
}

/* Response shapes confirmed against the live API, not just documentation:
   assign/awb wraps its payload in response.data, generate/label doesn't. */
interface AssignAwbResponse {
  awb_assign_status?: number;
  response?: {
    data?: {
      awb_code?: string;
      courier_name?: string;
      courier_company_id?: number;
      awb_assign_error?: string;
    };
  };
  message?: string;
}

interface GenerateLabelResponse {
  label_created?: number;
  label_url?: string;
  response?: string;
  not_created?: Record<string, string>;
}

interface GeneratePickupResponse {
  pickup_status?: number;
  response?: {
    pickup_scheduled_date?: string;
    pickup_token_number?: string;
  };
  message?: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function orderDate(): string {
  // Shiprocket expects "YYYY-MM-DD HH:MM"
  return new Date()
    .toISOString()
    .replace("T", " ")
    .slice(0, 16);
}

function itemWeightKg(type: string): number {
  const { itemWeightsG, defaultItemWeightG } = storeConfig.shipping;
  return (itemWeightsG[type] ?? defaultItemWeightG) / 1000;
}

function totalParcelWeightKg(items: ShipmentItem[]): number {
  const raw = items.reduce(
    (sum, item) => sum + itemWeightKg(item.type) * item.quantity,
    0
  );
  return Math.max(storeConfig.shipping.minChargeableWeightKg, parseFloat(raw.toFixed(3)));
}

/* ── Shiprocket order creation ────────────────────────────── */

async function createShiprocketOrder(
  body: CreateShipmentBody,
  token: string
): Promise<ShiprocketOrderResponse | null> {
  const { shipping, items, eyraOrderRef, paymentMethod, subtotal } = body;
  const { first_name, last_name } = splitName(shipping.fullName);

  const payload = {
    order_id: eyraOrderRef,
    order_date: orderDate(),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION ?? "Primary",

    billing_customer_name: first_name,
    billing_last_name: last_name,
    billing_address: shipping.addressLine1,
    billing_address_2: shipping.addressLine2 ?? "",
    billing_city: shipping.city,
    billing_pincode: Number(shipping.pincode),
    billing_state: shipping.state,
    billing_country: "India",
    billing_email: shipping.email,
    billing_phone: shipping.phone,
    shipping_is_billing: true,

    order_items: items.map((item) => ({
      name: item.name,
      sku: item.sku,
      units: item.quantity,
      selling_price: item.price,
      discount: 0,
      tax: storeConfig.jewelry.gstRate,
      hsn: storeConfig.jewelry.hsnCode,
    })),

    payment_method: paymentMethod === "cod" ? "COD" : "Prepaid",
    sub_total: subtotal,

    ...storeConfig.shipping.box,
    weight: totalParcelWeightKg(items),
  };

  try {
    const res = await fetch(`${SHIPROCKET_BASE}/orders/create/adhoc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return (await res.json()) as ShiprocketOrderResponse;
  } catch (err) {
    console.error("[Shiprocket] createShiprocketOrder network failure for order", body.eyraOrderRef, ":", err);
    return null;
  }
}

/* ── Post-order-creation pipeline ─────────────────────────── */

/**
 * Assign a courier and AWB to a shipment that doesn't already have one.
 * orders/create/adhoc only returns awb_code inline when the Shiprocket
 * account has "auto-assign courier" enabled in its dashboard settings;
 * confirmed live against this account that it does not, awb_code comes back
 * empty and this call is required before a label can be generated.
 */
async function assignAwb(
  shipmentId: string,
  token: string
): Promise<{ awbCode: string; courierName: string; failureReason?: undefined } | { awbCode?: undefined; courierName?: undefined; failureReason: string }> {
  try {
    const res = await fetch(`${SHIPROCKET_BASE}/courier/assign/awb`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shipment_id: Number(shipmentId) }),
      cache: "no-store",
    });
    const data = (await res.json()) as AssignAwbResponse;
    const awbCode = data.response?.data?.awb_code;
    const courierName = data.response?.data?.courier_name;
    if (!awbCode) {
      // Not fatal, the shipment already exists in Shiprocket; a human can
      // still assign a courier from the dashboard. Common cause: an empty
      // Shiprocket wallet, confirmed to surface here as awb_assign_error.
      const reason = data.response?.data?.awb_assign_error ?? data.message ?? "no AWB returned";
      console.error("[Shiprocket] assign/awb did not return an AWB for shipment", shipmentId, ":", reason);
      return { failureReason: reason };
    }
    return { awbCode, courierName: courierName ?? "" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[Shiprocket] assign/awb network failure for shipment", shipmentId, ":", err);
    return { failureReason: reason };
  }
}

/** Generate the printable shipping label PDF. Requires an AWB to already be assigned. */
async function generateLabel(
  shipmentId: string,
  token: string
): Promise<{ labelUrl: string; failureReason?: undefined } | { labelUrl?: undefined; failureReason: string }> {
  try {
    const res = await fetch(`${SHIPROCKET_BASE}/courier/generate/label`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shipment_id: [Number(shipmentId)] }),
      cache: "no-store",
    });
    const data = (await res.json()) as GenerateLabelResponse;
    if (!data.label_created || !data.label_url) {
      const reason = data.not_created?.[shipmentId] ?? data.response ?? "label not created";
      console.error("[Shiprocket] generate/label failed for shipment", shipmentId, ":", reason);
      return { failureReason: reason };
    }
    return { labelUrl: data.label_url };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[Shiprocket] generate/label network failure for shipment", shipmentId, ":", err);
    return { failureReason: reason };
  }
}

/**
 * Request courier pickup for the shipment. This schedules a real,
 * physical pickup with the courier at the configured pickup location, not
 * just a database record, so failures here are logged loudly but still
 * treated as non-fatal: the order and label already exist regardless, and
 * pickup can always be requested manually from the Shiprocket dashboard as
 * a fallback.
 */
async function generatePickup(
  shipmentId: string,
  token: string
): Promise<{ scheduled: true; failureReason?: undefined } | { scheduled: false; failureReason: string }> {
  try {
    const res = await fetch(`${SHIPROCKET_BASE}/courier/generate/pickup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shipment_id: [Number(shipmentId)] }),
      cache: "no-store",
    });
    const data = (await res.json()) as GeneratePickupResponse;
    if (!data.pickup_status) {
      const reason = data.message ?? "pickup not scheduled";
      console.error("[Shiprocket] generate/pickup failed for shipment", shipmentId, ":", reason);
      return { scheduled: false, failureReason: reason };
    }
    return { scheduled: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[Shiprocket] generate/pickup network failure for shipment", shipmentId, ":", err);
    return { scheduled: false, failureReason: reason };
  }
}

/* ── Medusa order metadata update ─────────────────────────── */

async function persistToMedusa(
  medusaOrderId: string,
  data: { shipmentId: string; awbCode: string; courierName: string; labelUrl?: string; pickupScheduled?: boolean }
): Promise<string | null> {
  const adminKey = process.env.MEDUSA_ADMIN_API_KEY;
  if (!adminKey) return null;

  try {
    await fetch(`${MEDUSA_BASE}/admin/orders/${medusaOrderId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Secret API keys (sk_...) authenticate via HTTP Basic, not this header.
        Authorization: `Basic ${adminKey}`,
      },
      body: JSON.stringify({
        metadata: {
          shiprocket_shipment_id: data.shipmentId,
          awb_code: data.awbCode,
          courier_name: data.courierName,
          ...(data.labelUrl ? { shipping_label_url: data.labelUrl } : {}),
          ...(data.pickupScheduled !== undefined ? { pickup_scheduled: data.pickupScheduled } : {}),
        },
      }),
      cache: "no-store",
    });
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Medusa] persistToMedusa failed for order", medusaOrderId, "shipment exists but metadata not written:", err);
    return `Medusa metadata write failed: ${msg}`;
  }
}

/* ── Route handler ────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, "shipping_create_shipment", 10);
  if (rateLimitResponse) return rateLimitResponse;

  const token = process.env.SHIPROCKET_API_TOKEN;

  let body: Partial<CreateShipmentBody>;
  try {
    body = (await request.json()) as Partial<CreateShipmentBody>;
  } catch (err) {
    console.warn("[create-shipment] Failed to parse request body:", err);
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { medusaOrderId, eyraOrderRef, paymentMethod, shipping, items, subtotal } = body;

  if (!eyraOrderRef || !paymentMethod || !shipping || !items?.length || subtotal == null) {
    return Response.json(
      { error: "Missing required fields: eyraOrderRef, paymentMethod, shipping, items, subtotal." },
      { status: 400 }
    );
  }

  // Shiprocket not configured, return a graceful no-op so checkout is not blocked.
  if (!token) {
    const result: CreateShipmentResult = {
      success: false,
      shipmentId: null,
      awbCode: null,
      courierName: null,
      labelUrl: null,
      error: "SHIPROCKET_API_TOKEN not configured.",
    };
    return Response.json(result);
  }

  const srResponse = await createShiprocketOrder(
    { medusaOrderId, eyraOrderRef, paymentMethod, shipping, items, subtotal },
    token
  );

  if (!srResponse || srResponse.status_code === undefined) {
    // The most severe failure mode: no shipment record exists in Shiprocket
    // at all. Worth an immediate alert rather than waiting to notice a
    // customer's order never got a tracking number.
    await sendOpsAlert(`Shiprocket order creation failed for ${eyraOrderRef}`, [
      `Medusa order: ${medusaOrderId ?? "(not yet known)"}`,
      `Shiprocket response: ${JSON.stringify(srResponse)?.slice(0, 300) ?? "no response"}`,
      "No shipment exists yet. This order needs to be created manually in Shiprocket.",
    ]);
    const result: CreateShipmentResult = {
      success: false,
      shipmentId: null,
      awbCode: null,
      courierName: null,
      labelUrl: null,
      error: "Shiprocket API returned an unexpected response.",
    };
    return Response.json(result);
  }

  const shipmentId = srResponse.shipment_id ? String(srResponse.shipment_id) : null;
  let awbCode = srResponse.awb_code || null;
  let courierName = srResponse.courier_name || null;
  let labelUrl: string | null = null;
  let pickupScheduled: boolean | undefined;
  // Collected across the pipeline and sent as one alert at the end, rather
  // than one email per failed step, since a single root cause (e.g. an
  // empty Shiprocket wallet) tends to cascade into several of these at once.
  const failures: string[] = [];

  // orders/create/adhoc only returns an AWB inline when the Shiprocket
  // account has auto-assign-courier enabled. Confirmed live against this
  // account that it doesn't, so assign one explicitly, then a label can't
  // be generated without an AWB, and pickup shouldn't be requested for a
  // shipment nothing has actually picked up an AWB for. Each step is
  // independently non-fatal: the Shiprocket order itself already exists by
  // this point regardless of what happens next, and any step that fails
  // here can still be completed manually from the Shiprocket dashboard.
  if (shipmentId) {
    if (!awbCode) {
      const assigned = await assignAwb(shipmentId, token);
      if (assigned.awbCode) {
        awbCode = assigned.awbCode;
        courierName = assigned.courierName || courierName;
      } else {
        failures.push(`Courier/AWB assignment failed: ${assigned.failureReason}`);
      }
    }

    if (awbCode) {
      const label = await generateLabel(shipmentId, token);
      if (label.labelUrl) {
        labelUrl = label.labelUrl;
      } else {
        failures.push(`Label generation failed: ${label.failureReason}`);
      }

      // Unlike AWB assignment and label generation, this requests an actual
      // physical pickup with the courier, one per order rather than a
      // single batched pickup for the day's orders. Kept behind an env var
      // (default on) so that can be turned off without a code change if
      // per-order pickup requests turn out to be the wrong operational fit.
      if (process.env.SHIPROCKET_AUTO_PICKUP !== "false") {
        const pickup = await generatePickup(shipmentId, token);
        pickupScheduled = pickup.scheduled;
        if (!pickup.scheduled) failures.push(`Pickup request failed: ${pickup.failureReason}`);
      }
    } else {
      failures.push("Label and pickup skipped: no AWB was assigned.");
    }
  }

  if (failures.length > 0) {
    await sendOpsAlert(`Shipping needs manual attention: order ${eyraOrderRef}`, [
      `Medusa order: ${medusaOrderId ?? "(not linked)"}`,
      `Shiprocket shipment: ${shipmentId ?? "(none)"}`,
      ...failures,
    ]);
  }

  // Persist tracking data back to Medusa order metadata.
  let persistWarning: string | null = null;
  if (medusaOrderId && shipmentId) {
    persistWarning = await persistToMedusa(medusaOrderId, {
      shipmentId,
      awbCode: awbCode ?? "",
      courierName: courierName ?? "",
      labelUrl: labelUrl ?? undefined,
      pickupScheduled,
    });
    // The Shiprocket status webhook only echoes back eyraOrderRef, not the
    // Medusa order ID, remember the mapping so it can resolve the order.
    await rememberOrderForShipment(eyraOrderRef, medusaOrderId);

    if (persistWarning) {
      await sendOpsAlert(`Shipment created but Medusa wasn't updated: order ${eyraOrderRef}`, [
        `Medusa order: ${medusaOrderId}`,
        `Shiprocket shipment: ${shipmentId}, AWB: ${awbCode ?? "(none)"}`,
        persistWarning,
        "The shipment and label exist in Shiprocket, but the order in Medusa doesn't show it. Update the order metadata manually.",
      ]);
    }
  }

  // A new order needs to be packed and shipped regardless of whether the
  // steps above all succeeded, this is the only notification that a human
  // gets that an order exists at all; without it the only way to notice one
  // was to open Medusa admin. Sent whenever the Shiprocket order itself was
  // created, even if AWB/label failed and there's nothing to download yet,
  // since sendOpsAlert above already explains why in that case.
  if (shipmentId) {
    await sendOrderPlacedNotification({
      eyraOrderRef,
      medusaOrderId,
      paymentMethod,
      subtotal,
      items: items.map((i) => ({ name: i.name, sku: i.sku, quantity: i.quantity })),
      shipping,
      awbCode,
      courierName,
      labelUrl,
    });
  }

  const result: CreateShipmentResult = {
    success: true,
    shipmentId,
    awbCode,
    courierName,
    labelUrl,
    ...(persistWarning ? { warning: persistWarning } : {}),
  };
  return Response.json(result);
}

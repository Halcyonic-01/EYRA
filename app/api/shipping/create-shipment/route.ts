import type { NextRequest } from "next/server";
import { storeConfig } from "@/config/storeConfig";
import { rememberOrderForShipment } from "@/lib/shiprocket-store";
import { splitName } from "@/lib/medusa-order";
import { checkInternalRequest } from "@/lib/internal-auth";
import { getShiprocketToken, hasShiprocketLogin } from "@/lib/shiprocket-token";
import { sendOpsAlert, sendOrderPlacedNotification } from "@/lib/ops-alert";

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";
/** Per call to Shiprocket, so one hung request cannot outlast the route. */
const SHIPROCKET_TIMEOUT_MS = 15000;
const MEDUSA_TIMEOUT_MS = 10000;

// The backend waits 150 s for this route, longer than this, so it never
// retries while a first attempt could still be creating the shipment.
export const maxDuration = 120;
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
  /** True when the order already had a shipment, so nothing new was created. */
  existing?: boolean;
  /** Shiprocket's own numeric order id, needed later to cancel the order there. */
  shiprocketOrderId?: string | null;
  pickupScheduled?: boolean | null;
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
      signal: AbortSignal.timeout(SHIPROCKET_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(SHIPROCKET_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(SHIPROCKET_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(SHIPROCKET_TIMEOUT_MS),
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

/** Writes shipment facts onto the order. Returns a warning when it could not. */
async function persistToMedusa(
  medusaOrderId: string,
  data: {
    shipmentId: string;
    shiprocketOrderId?: string;
    awbCode?: string;
    courierName?: string;
    labelUrl?: string;
    pickupScheduled?: boolean;
  }
): Promise<string | null> {
  const adminKey = process.env.MEDUSA_ADMIN_API_KEY;
  if (!adminKey) return "MEDUSA_ADMIN_API_KEY is not set";

  try {
    const res = await fetch(`${MEDUSA_BASE}/admin/orders/${encodeURIComponent(medusaOrderId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Secret API keys (sk_...) authenticate via HTTP Basic, not this header.
        Authorization: `Basic ${adminKey}`,
      },
      body: JSON.stringify({
        metadata: {
          shiprocket_shipment_id: data.shipmentId,
          ...(data.shiprocketOrderId ? { shiprocket_order_id: data.shiprocketOrderId } : {}),
          ...(data.awbCode !== undefined ? { awb_code: data.awbCode } : {}),
          ...(data.courierName !== undefined ? { courier_name: data.courierName } : {}),
          ...(data.labelUrl ? { shipping_label_url: data.labelUrl } : {}),
          ...(data.pickupScheduled !== undefined ? { pickup_scheduled: data.pickupScheduled } : {}),
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(MEDUSA_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[Medusa] persistToMedusa answered", res.status, "for order", medusaOrderId);
      return `Medusa metadata write failed: HTTP ${res.status}`;
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Medusa] persistToMedusa failed for order", medusaOrderId, "shipment exists but metadata not written:", err);
    return `Medusa metadata write failed: ${msg}`;
  }
}

type Lookup<T> = { status: "found"; value: T } | { status: "none" } | { status: "unknown"; error: string };

/**
 * The shipment this order already has, if any. A retry after a lost response
 * must hand back the existing one, never create a second courier order, so a
 * failed check means "unknown", never "none".
 */
async function findExistingShipment(medusaOrderId: string): Promise<Lookup<CreateShipmentResult>> {
  const adminKey = process.env.MEDUSA_ADMIN_API_KEY;
  if (!adminKey) return { status: "unknown", error: "MEDUSA_ADMIN_API_KEY is not set" };

  try {
    const res = await fetch(`${MEDUSA_BASE}/admin/orders/${encodeURIComponent(medusaOrderId)}?fields=id,metadata`, {
      headers: { Authorization: `Basic ${adminKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(MEDUSA_TIMEOUT_MS),
    });
    if (!res.ok) return { status: "unknown", error: `Medusa answered ${res.status}` };
    const data = (await res.json()) as { order?: { metadata?: Record<string, unknown> | null } };
    if (!data.order) return { status: "unknown", error: "Medusa returned no order" };
    const meta = data.order.metadata ?? {};
    const shipmentId = typeof meta.shiprocket_shipment_id === "string" ? meta.shiprocket_shipment_id : "";
    if (!shipmentId) return { status: "none" };

    const text = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
    return {
      status: "found",
      value: {
        success: true,
        existing: true,
        shipmentId,
        shiprocketOrderId: text(meta.shiprocket_order_id),
        awbCode: text(meta.awb_code),
        courierName: text(meta.courier_name),
        labelUrl: text(meta.shipping_label_url),
        pickupScheduled: typeof meta.pickup_scheduled === "boolean" ? meta.pickup_scheduled : null,
      },
    };
  } catch (err) {
    console.error("[create-shipment] could not check for an existing shipment on", medusaOrderId, ":", err);
    return { status: "unknown", error: err instanceof Error ? err.message : String(err) };
  }
}

interface ShiprocketListedOrder {
  id?: number | string;
  channel_order_id?: string | number;
  status?: string;
  shipments?: { id?: number | string; awb?: string | null; awb_code?: string | null; courier?: string | null }[];
}

interface FoundShiprocketOrder {
  orderId: string;
  shipmentId: string;
  awbCode: string | null;
  courierName: string | null;
}

/**
 * An order Shiprocket already has under this reference, for example from an
 * attempt that created it but never got to record it. Cancelled ones are ignored.
 */
async function findShiprocketOrder(eyraOrderRef: string, token: string): Promise<Lookup<FoundShiprocketOrder>> {
  try {
    const url = new URL(`${SHIPROCKET_BASE}/orders`);
    url.searchParams.set("search", eyraOrderRef);
    url.searchParams.set("per_page", "50");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(SHIPROCKET_TIMEOUT_MS),
    });
    if (!res.ok) return { status: "unknown", error: `Shiprocket order search answered ${res.status}` };
    const body = (await res.json()) as { data?: unknown };
    if (!Array.isArray(body.data)) return { status: "unknown", error: "Shiprocket order search returned an unexpected shape" };

    const match = (body.data as ShiprocketListedOrder[]).find(
      (order) =>
        String(order.channel_order_id ?? "") === eyraOrderRef &&
        !String(order.status ?? "").toUpperCase().includes("CANCEL")
    );
    const shipment = match?.shipments?.[0];
    if (!match?.id || !shipment?.id) return { status: "none" };
    return {
      status: "found",
      value: {
        orderId: String(match.id),
        shipmentId: String(shipment.id),
        awbCode: shipment.awb || shipment.awb_code || null,
        courierName: shipment.courier || null,
      },
    };
  } catch (err) {
    return { status: "unknown", error: err instanceof Error ? err.message : String(err) };
  }
}

const failure = (error: string): CreateShipmentResult => ({
  success: false,
  shipmentId: null,
  awbCode: null,
  courierName: null,
  labelUrl: null,
  error,
});

/* ── Route handler ────────────────────────────────────────── */

/**
 * Creates the Shiprocket order, courier, label and pickup for one order.
 *
 * Called only by the Medusa backend's dispatcher, which decides when an order
 * ships (after the customer's cancel window), so it is authenticated with the
 * shared backend secret and is not callable from a browser.
 */
export async function POST(request: NextRequest) {
  const auth = checkInternalRequest(request);
  if (auth === "unconfigured") {
    return Response.json({ error: "Shipping is not configured." }, { status: 503 });
  }
  if (auth === "unauthorized") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let token = await getShiprocketToken();

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

  const autoPickup = process.env.SHIPROCKET_AUTO_PICKUP !== "false";

  let shipmentId: string | null = null;
  let shiprocketOrderId: string | null = null;
  let awbCode: string | null = null;
  let courierName: string | null = null;
  let labelUrl: string | null = null;
  let pickupScheduled: boolean | undefined;

  if (medusaOrderId) {
    const existing = await findExistingShipment(medusaOrderId);
    if (existing.status === "unknown") {
      // Creating now could duplicate a shipment we just failed to see; the dispatcher retries.
      return Response.json(failure(`Could not check for an existing shipment: ${existing.error}`), { status: 503 });
    }
    if (existing.status === "found") {
      const e = existing.value;
      const done = Boolean(e.awbCode && e.labelUrl) && (!autoPickup || e.pickupScheduled === true);
      if (done) return Response.json(e);
      // A shipment left half set up by an earlier attempt: finish it, never recreate it.
      shipmentId = e.shipmentId;
      shiprocketOrderId = e.shiprocketOrderId ?? null;
      awbCode = e.awbCode ?? null;
      courierName = e.courierName ?? null;
      labelUrl = e.labelUrl ?? null;
      pickupScheduled = e.pickupScheduled ?? undefined;
    }
  }

  // Shiprocket not configured, so no shipment can be created. The dispatcher
  // records this as a failed attempt and retries.
  if (!token) {
    return Response.json(failure("SHIPROCKET_API_TOKEN not configured."));
  }

  if (!shipmentId) {
    // An earlier attempt may have created the order in Shiprocket and died before
    // recording it. Adopt that one rather than booking a second parcel.
    let prior = await findShiprocketOrder(eyraOrderRef, token);
    if (prior.status === "unknown" && prior.error.includes("401") && hasShiprocketLogin()) {
      token = (await getShiprocketToken(true)) ?? token;
      prior = await findShiprocketOrder(eyraOrderRef, token);
    }
    if (prior.status === "unknown") {
      return Response.json(failure(`Could not check Shiprocket for an existing order: ${prior.error}`), { status: 503 });
    }

    if (prior.status === "found") {
      console.warn("[Shiprocket] adopting existing order", prior.value.orderId, "for", eyraOrderRef);
      shipmentId = prior.value.shipmentId;
      shiprocketOrderId = prior.value.orderId;
      awbCode = prior.value.awbCode;
      courierName = prior.value.courierName;
    } else {
      const srResponse = await createShiprocketOrder(
        { medusaOrderId, eyraOrderRef, paymentMethod, shipping, items, subtotal },
        token
      );

      if (!srResponse || srResponse.status_code === undefined) {
        // The order may or may not exist in Shiprocket now. The retry looks it up
        // by reference before creating, so it is never booked twice.
        return Response.json(failure("Shiprocket API returned an unexpected response."));
      }

      if (!srResponse.shipment_id) {
        const reason = srResponse.message ?? `Shiprocket answered with status ${srResponse.status_code}`;
        console.error("[Shiprocket] order creation was refused for", eyraOrderRef, ":", reason);
        return Response.json(failure(`Shiprocket did not create the order: ${reason}`));
      }

      shipmentId = String(srResponse.shipment_id);
      shiprocketOrderId = srResponse.order_id ? String(srResponse.order_id) : null;
      awbCode = srResponse.awb_code || null;
      courierName = srResponse.courier_name || null;
    }

    // Record the shipment at once, before the slower courier steps, so a retry
    // that starts after this point finds it and does not book another.
    if (medusaOrderId) {
      const early = await persistToMedusa(medusaOrderId, {
        shipmentId,
        shiprocketOrderId: shiprocketOrderId ?? undefined,
      });
      if (early) console.error("[create-shipment] early record failed for", eyraOrderRef, ":", early);
    }
  }

  // Each courier step runs only if it is still missing, so a retry finishes the
  // job instead of redoing it. A shipment counts as done only when it has a
  // courier, a label and (unless switched off) a scheduled pickup; until then
  // the dispatcher keeps retrying and the order is not marked shipped.
  const failures: string[] = [];

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
    if (!labelUrl) {
      const label = await generateLabel(shipmentId, token);
      if (label.labelUrl) {
        labelUrl = label.labelUrl;
      } else {
        failures.push(`Label generation failed: ${label.failureReason}`);
      }
    }

    // This requests a real, physical pickup with the courier, one per order.
    // SHIPROCKET_AUTO_PICKUP=false turns it off.
    if (autoPickup && pickupScheduled !== true) {
      const pickup = await generatePickup(shipmentId, token);
      pickupScheduled = pickup.scheduled;
      if (!pickup.scheduled) failures.push(`Pickup request failed: ${pickup.failureReason}`);
    }
  } else {
    failures.push("Label and pickup skipped: no AWB was assigned.");
  }

  // Persist what is known so far, complete or not.
  let persistWarning: string | null = null;
  if (medusaOrderId) {
    persistWarning = await persistToMedusa(medusaOrderId, {
      shipmentId,
      shiprocketOrderId: shiprocketOrderId ?? undefined,
      awbCode: awbCode ?? "",
      courierName: courierName ?? "",
      labelUrl: labelUrl ?? undefined,
      pickupScheduled,
    });
    // The Shiprocket status webhook only echoes back eyraOrderRef, not the
    // Medusa order ID, remember the mapping so it can resolve the order.
    await rememberOrderForShipment(eyraOrderRef, medusaOrderId);
  }

  if (failures.length > 0) {
    // The dispatcher records this as a failed attempt, retries, and alerts the team.
    const result: CreateShipmentResult = {
      success: false,
      shipmentId,
      awbCode,
      courierName,
      labelUrl,
      pickupScheduled: pickupScheduled ?? null,
      shiprocketOrderId,
      error: `The shipment exists in Shiprocket (${shipmentId}) but is not finished: ${failures.join("; ")}`,
    };
    return Response.json(result);
  }

  if (persistWarning) {
    await sendOpsAlert(`Shipment created but Medusa wasn't updated: order ${eyraOrderRef}`, [
      `Medusa order: ${medusaOrderId}`,
      `Shiprocket shipment: ${shipmentId}, AWB: ${awbCode ?? "(none)"}`,
      persistWarning,
      "The shipment and label exist in Shiprocket, but the order in Medusa doesn't show it. Update the order metadata manually.",
    ]);
  }

  // The team's "pack and ship this" email, with the label, goes out once the
  // shipment is complete.
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

  const result: CreateShipmentResult = {
    success: true,
    shipmentId,
    awbCode,
    courierName,
    labelUrl,
    pickupScheduled: pickupScheduled ?? null,
    shiprocketOrderId,
    ...(persistWarning ? { warning: persistWarning } : {}),
  };
  return Response.json(result);
}

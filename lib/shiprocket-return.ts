/**
 * Booking a courier to bring an item back to us: Shiprocket's "create return
 * order" (POST /v1/external/orders/create/return) and then the AWB for it.
 *
 * The payload builder is a pure function so it can be tested. The call itself
 * takes the token and fetch as arguments, so a test can drive it without the
 * network. The shape follows Shiprocket's published API and has not been run
 * against the live service: the first real return is the test of it.
 */
/** First name and the rest. (Kept here: the order helper is server-only and this must be testable on its own.) */
function splitName(fullName: string): { first_name: string; last_name: string } {
  const [first_name, ...rest] = fullName.trim().split(/\s+/);
  return { first_name: first_name || fullName, last_name: rest.join(" ") };
}

export const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";

export interface ReversePickupRequest {
  return_request_id: string;
  order_ref: string;
  reverse_order_ref: string;
  type: "return" | "exchange";
  reason: string;
  pickup: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
  };
  items: { name: string; sku: string; quantity: number; price: number; packSize: number }[];
}

/** Where the item is brought to: the warehouse the courier delivers returns to. */
export interface ReturnWarehouse {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
}

export interface ParcelSettings {
  box: { length: number; breadth: number; height: number };
  weightKg: number;
}

/** Why a request cannot be sent at all, or null when it can. */
export function reversePickupProblems(input: ReversePickupRequest): string | null {
  if (!/^EYRA-[\w-]+$/.test(input.reverse_order_ref)) return "The reverse order reference is not valid.";
  if (!input.items.length) return "There is nothing to pick up.";
  const { pickup } = input;
  if (!pickup.addressLine1 || !pickup.city || !pickup.state) return "The pickup address is incomplete.";
  if (!/^\d{6}$/.test(pickup.pincode)) return "The pickup pincode is not valid.";
  if (!/^\d{10}$/.test(pickup.phone.replace(/\D/g, "").slice(-10))) return "The pickup phone number is not valid.";
  return null;
}

function istDate(now: Date): string {
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function buildReturnOrderPayload(
  input: ReversePickupRequest,
  warehouse: ReturnWarehouse,
  parcel: ParcelSettings,
  now: Date = new Date()
) {
  const pickup = input.pickup;
  const customer = splitName(pickup.fullName);
  const subTotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const phone = pickup.phone.replace(/\D/g, "").slice(-10);

  return {
    order_id: input.reverse_order_ref,
    order_date: istDate(now),
    channel_id: "",
    pickup_customer_name: customer.first_name,
    pickup_last_name: customer.last_name,
    company_name: "",
    pickup_address: pickup.addressLine1,
    pickup_address_2: pickup.addressLine2 ?? "",
    pickup_city: pickup.city,
    pickup_state: pickup.state,
    pickup_country: "India",
    pickup_pincode: Number(pickup.pincode),
    pickup_email: pickup.email,
    pickup_phone: phone,
    pickup_isd_code: "91",
    shipping_customer_name: warehouse.name,
    shipping_last_name: "",
    shipping_address: warehouse.addressLine1,
    shipping_address_2: warehouse.addressLine2,
    shipping_city: warehouse.city,
    shipping_country: "India",
    shipping_pincode: Number(warehouse.pincode),
    shipping_state: warehouse.state,
    shipping_email: warehouse.email,
    shipping_isd_code: "91",
    shipping_phone: warehouse.phone.replace(/\D/g, "").slice(-10),
    order_items: input.items.map((item) => ({
      name: item.name,
      sku: item.sku,
      units: item.quantity,
      selling_price: item.price,
      discount: 0,
      qc_enable: false,
    })),
    payment_method: "PREPAID",
    total_discount: "0",
    sub_total: subTotal,
    length: parcel.box.length,
    breadth: parcel.box.breadth,
    height: parcel.box.height,
    weight: parcel.weightKg,
  };
}

export type ReversePickupOutcome =
  | { ok: true; shiprocketOrderId: string | null; shipmentId: string | null; awbCode: string | null; warning?: string }
  | { ok: false; error: string };

type Fetch = typeof fetch;

/**
 * Creates the return order, then asks for an AWB for it. A return order that
 * exists without an AWB is still a success (the AWB can be assigned in the
 * Shiprocket dashboard, and updates are matched by the order reference), and the
 * warning says so.
 */
export async function createReturnOrder(
  payload: ReturnType<typeof buildReturnOrderPayload>,
  token: string,
  fetchImpl: Fetch = fetch
): Promise<ReversePickupOutcome> {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  let created: { order_id?: number | string; shipment_id?: number | string; message?: string; errors?: unknown };
  try {
    const res = await fetchImpl(`${SHIPROCKET_BASE}/orders/create/return`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    created = (await res.json().catch(() => ({}))) as typeof created;
    if (!res.ok || (!created.order_id && !created.shipment_id)) {
      const detail = created.message ?? (created.errors ? JSON.stringify(created.errors) : `Shiprocket answered ${res.status}`);
      return { ok: false, error: String(detail).slice(0, 300) };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const shipmentId = created.shipment_id != null ? String(created.shipment_id) : null;
  const orderId = created.order_id != null ? String(created.order_id) : null;
  if (!shipmentId) return { ok: true, shiprocketOrderId: orderId, shipmentId: null, awbCode: null, warning: "No shipment id came back" };

  try {
    const res = await fetchImpl(`${SHIPROCKET_BASE}/courier/assign/awb`, {
      method: "POST",
      headers,
      body: JSON.stringify({ shipment_id: Number(shipmentId), is_return: 1 }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      response?: { data?: { awb_code?: string; awb_assign_error?: string } };
      message?: string;
    };
    const awb = body.response?.data?.awb_code ?? null;
    if (!awb) {
      const reason = body.response?.data?.awb_assign_error ?? body.message ?? "no AWB returned";
      return { ok: true, shiprocketOrderId: orderId, shipmentId, awbCode: null, warning: `The return order exists but has no courier yet: ${reason}` };
    }
    return { ok: true, shiprocketOrderId: orderId, shipmentId, awbCode: awb };
  } catch (error) {
    return {
      ok: true,
      shiprocketOrderId: orderId,
      shipmentId,
      awbCode: null,
      warning: `The return order exists but its courier could not be assigned: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

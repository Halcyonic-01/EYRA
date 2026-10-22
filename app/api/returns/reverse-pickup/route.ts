import type { NextRequest } from "next/server";

import { storeConfig } from "@/config/storeConfig";
import { checkShipmentRequest } from "@/lib/internal-auth";
import {
  buildReturnOrderPayload,
  createReturnOrder,
  reversePickupProblems,
  type ReturnWarehouse,
  type ReversePickupRequest,
} from "@/lib/shiprocket-return";
import { getShiprocketToken } from "@/lib/shiprocket-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Where returns are delivered: the registered address, unless a warehouse is set (SHIPROCKET_RETURN_*). */
function returnWarehouse(): ReturnWarehouse {
  const { seller, contact } = storeConfig;
  return {
    name: process.env.SHIPROCKET_RETURN_NAME?.trim() || seller.legalName,
    addressLine1: process.env.SHIPROCKET_RETURN_ADDRESS_1?.trim() || seller.addressLine1,
    addressLine2: process.env.SHIPROCKET_RETURN_ADDRESS_2?.trim() || seller.addressLine2,
    city: process.env.SHIPROCKET_RETURN_CITY?.trim() || seller.city,
    state: process.env.SHIPROCKET_RETURN_STATE?.trim() || seller.state,
    pincode: process.env.SHIPROCKET_RETURN_PINCODE?.trim() || seller.pincode,
    phone: process.env.SHIPROCKET_RETURN_PHONE?.trim() || "",
    email: process.env.SHIPROCKET_RETURN_EMAIL?.trim() || contact.ordersEmail,
  };
}

/**
 * Books the courier to collect a return or exchange item, through Shiprocket's
 * return order. Called only by the Medusa backend. It answers { success, ... }
 * and never throws: the backend keeps the customer's request either way, and
 * tells the team when this fails.
 */
export async function POST(request: NextRequest) {
  const auth = checkShipmentRequest(request);
  if (auth === "unconfigured") return Response.json({ success: false, error: "Not configured." }, { status: 503 });
  if (auth === "unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: ReversePickupRequest;
  try {
    body = (await request.json()) as ReversePickupRequest;
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !body.pickup || !Array.isArray(body.items)) {
    return Response.json({ success: false, error: "The request is incomplete." }, { status: 400 });
  }
  const problem = reversePickupProblems(body);
  if (problem) return Response.json({ success: false, error: problem }, { status: 400 });

  const warehouse = returnWarehouse();
  if (!warehouse.phone) {
    return Response.json(
      { success: false, error: "SHIPROCKET_RETURN_PHONE is not set: Shiprocket needs a phone number for the warehouse the item is delivered to." },
      { status: 503 }
    );
  }
  const token = await getShiprocketToken();
  if (!token) return Response.json({ success: false, error: "Shiprocket is not set up." }, { status: 503 });

  const weightKg = Math.max(
    storeConfig.shipping.minChargeableWeightKg,
    body.items.reduce(
      (sum, item) => sum + ((storeConfig.shipping.itemWeightsG.ring ?? storeConfig.shipping.defaultItemWeightG) / 1000) * item.quantity * Math.max(1, item.packSize),
      0
    )
  );
  const payload = buildReturnOrderPayload(body, warehouse, { box: storeConfig.shipping.box, weightKg });

  const outcome = await createReturnOrder(payload, token);
  if (!outcome.ok) {
    console.error("[returns/reverse-pickup] could not book", body.reverse_order_ref, ":", outcome.error);
    return Response.json({ success: false, error: outcome.error }, { status: 502 });
  }
  if (outcome.warning) console.warn("[returns/reverse-pickup]", body.reverse_order_ref, outcome.warning);
  return Response.json({
    success: true,
    reverse_order_ref: body.reverse_order_ref,
    shiprocket_order_id: outcome.shiprocketOrderId,
    shipment_id: outcome.shipmentId,
    awb_code: outcome.awbCode,
    warning: outcome.warning ?? null,
  });
}

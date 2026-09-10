import type { NextRequest } from "next/server";
import { applyRateLimit } from "@/lib/rateLimit";

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";

/** Default parcel weight in kg, safe upper bound for silver jewelry. */
const DEFAULT_WEIGHT_KG = 0.5;

interface ShiprocketCourier {
  courier_name: string;
  estimated_delivery_days: string | number;
  cod: 0 | 1;
}

interface ShiprocketServiceabilityResponse {
  status: number;
  data?: {
    available_courier_companies?: ShiprocketCourier[];
  };
}

export interface ServiceabilityResult {
  serviceable: boolean;
  estimatedDays: number;
  availablePaymentMethods: string[];
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, "shipping_serviceability", 20);
  if (rateLimitResponse) return rateLimitResponse;

  const token = process.env.SHIPROCKET_API_TOKEN;
  const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE;

  if (!token || !pickupPincode) {
    // Shiprocket not yet configured, return a permissive fallback so checkout
    // is not blocked during development/staging.
    const fallback: ServiceabilityResult = {
      serviceable: true,
      estimatedDays: 5,
      availablePaymentMethods: ["prepaid", "cod"],
    };
    return Response.json(fallback);
  }

  let body: { pincode?: string };
  try {
    body = (await request.json()) as { pincode?: string };
  } catch (err) {
    console.warn("[Shiprocket/serviceability] Failed to parse request body:", err);
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { pincode } = body;
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return Response.json({ error: "A valid 6-digit pincode is required." }, { status: 400 });
  }

  const params = new URLSearchParams({
    pickup_postcode: pickupPincode,
    delivery_postcode: pincode,
    weight: String(DEFAULT_WEIGHT_KG),
    cod: "1",
  });

  /**
   * Used whenever we could not get a real answer out of Shiprocket. It has to
   * be permissive: the alternative is telling a customer with a perfectly
   * deliverable address that we don't serve them, and losing the order.
   */
  const inconclusive: ServiceabilityResult = {
    serviceable: true,
    estimatedDays: 5,
    availablePaymentMethods: ["prepaid", "cod"],
  };

  let shiprocketData: ShiprocketServiceabilityResponse;
  try {
    const res = await fetch(
      `${SHIPROCKET_BASE}/courier/serviceability/?${params.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    // A non-2xx reply still carries a parseable JSON body, just an error one
    // with no available_courier_companies in it. Reading it as a normal
    // response would collapse "our API call failed" into "no courier serves
    // this pincode", which is what the customer is then told, and what blocks
    // checkout. Shiprocket tokens expire every ~10 days, so a 401 here is an
    // expected operational event, not a hypothetical.
    if (!res.ok) {
      console.error(
        `[Shiprocket/serviceability] API returned ${res.status} ${res.statusText} for pincode ${pincode}. ` +
        (res.status === 401 || res.status === 403
          ? "SHIPROCKET_API_TOKEN is likely expired or invalid, regenerate it. "
          : "") +
        "Falling back to a permissive result so checkout is not blocked."
      );
      return Response.json(inconclusive);
    }

    shiprocketData = (await res.json()) as ShiprocketServiceabilityResponse;
  } catch (err) {
    console.error("[Shiprocket/serviceability] Serviceability fetch failed for pincode", pincode, ":", err);
    return Response.json(inconclusive);
  }

  const couriers = shiprocketData?.data?.available_courier_companies ?? [];

  if (couriers.length === 0) {
    const result: ServiceabilityResult = {
      serviceable: false,
      estimatedDays: 0,
      availablePaymentMethods: [],
    };
    return Response.json(result);
  }

  // Minimum estimated delivery days across all available couriers.
  const estimatedDays = couriers.reduce((min, c) => {
    const days = Number(c.estimated_delivery_days);
    return isNaN(days) ? min : Math.min(min, days);
  }, Infinity);

  // COD is available only if at least one courier supports it.
  const codAvailable = couriers.some((c) => c.cod === 1);

  const result: ServiceabilityResult = {
    serviceable: true,
    estimatedDays: isFinite(estimatedDays) ? estimatedDays : 5,
    // Prepaid is available whenever any courier operates on this route.
    availablePaymentMethods: codAvailable ? ["prepaid", "cod"] : ["prepaid"],
  };

  return Response.json(result);
}

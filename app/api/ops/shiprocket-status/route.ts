import type { NextRequest } from "next/server";

import { checkShipmentRequest } from "@/lib/internal-auth";
import { shiprocketStatus } from "@/lib/shiprocket-status";

export const dynamic = "force-dynamic";

/**
 * What would stop Shiprocket working: no token, an expired or soon-to-expire
 * token, a missing webhook secret or pickup location. Called by the Medusa
 * backend so the admin Shipping panel can say so before a shipment fails. It
 * reports names and dates only, never a secret.
 */
export async function POST(request: NextRequest) {
  const auth = checkShipmentRequest(request);
  if (auth === "unconfigured") {
    return Response.json({ error: "Not configured." }, { status: 503 });
  }
  if (auth === "unauthorized") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(shiprocketStatus(process.env));
}

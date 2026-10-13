import "server-only";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Checks a request that should only ever come from the Medusa backend, using
 * the secret the two already share (STOREFRONT_REVALIDATE_SECRET).
 */
export function checkInternalRequest(req: Request): "ok" | "unauthorized" | "unconfigured" {
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET;
  if (!secret) return "unconfigured";

  const received = req.headers.get("x-revalidate-secret");
  return received && safeEqual(received, secret) ? "ok" : "unauthorized";
}

/**
 * Checks a shipment request from the backend. Creating a shipment spends
 * Shiprocket wallet money, so it has its own secret (STOREFRONT_SHIPMENT_SECRET)
 * and falls back to the shared one only while that is not set.
 */
export function checkShipmentRequest(req: Request): "ok" | "unauthorized" | "unconfigured" {
  const secret = process.env.STOREFRONT_SHIPMENT_SECRET;
  if (!secret) return checkInternalRequest(req);

  const received = req.headers.get("x-shipment-secret");
  return received && safeEqual(received, secret) ? "ok" : "unauthorized";
}

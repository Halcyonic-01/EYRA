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

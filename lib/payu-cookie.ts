import { pickReturnFields, type PayuReturnFields } from "@/lib/payu";

/**
 * The PayU return fields as a cookie value, so the status page can ask the
 * backend about them again. Server side only (Buffer); no secrets inside.
 */
export function encodeReturnCookie(fields: PayuReturnFields): string {
  return Buffer.from(JSON.stringify(fields), "utf8").toString("base64url");
}

/** The fields back, picked again: the cookie is never trusted beyond what PayU's hash covers. */
export function decodeReturnCookie(value: string | undefined | null): PayuReturnFields | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return pickReturnFields(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}

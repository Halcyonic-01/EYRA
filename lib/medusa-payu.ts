/**
 * Server-only: the backend's PayU routes, and the short-lived cookie that lets
 * the payment status page ask about the customer's PayU return again.
 */
import "server-only";

import type { NextResponse } from "next/server";

import { encodeReturnCookie } from "@/lib/payu-cookie";
import {
  checkedPayuForm,
  type PayuCheckoutForm,
  type PayuOutcomeStatus,
  type PayuReturnFields,
} from "@/lib/payu";

const BASE_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

const MEDUSA_TIMEOUT_MS = 25000;

function storeHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(PUB_KEY ? { "x-publishable-api-key": PUB_KEY } : {}),
  };
}

/** A local fake PayU's origin, for tests only. Unset in production, so only PayU's own hosts pass. */
export function payuTestOrigin(): string | null {
  return process.env.PAYU_CHECKOUT_ORIGIN?.trim() || null;
}

/* ── Opening a payment ────────────────────────────────────── */

export type PayuCheckoutResult =
  | { ok: true; form: PayuCheckoutForm; txnid: string; amount: number }
  | { ok: false; status: number; message: string };

/**
 * Open a PayU attempt for a cart. The backend reprices the cart, records the
 * attempt and signs the hosted form with the salt; nothing comes from the browser.
 * Refused (4xx) while the cart is paid or another provider's payment is pending.
 */
export async function startPayuCheckout(cartId: string): Promise<PayuCheckoutResult> {
  try {
    const res = await fetch(`${BASE_URL}/store/carts/${encodeURIComponent(cartId)}/payu-session`, {
      method: "POST",
      headers: storeHeaders(),
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(MEDUSA_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as {
      form?: unknown; txnid?: unknown; amount?: unknown; message?: unknown;
    };
    if (!res.ok) {
      console.error(`[medusa-payu] payu session ${res.status}, cart ${cartId}: ${String(body.message ?? "")}`);
      return {
        ok: false,
        status: res.status,
        message: typeof body.message === "string" ? body.message : "Payment could not be started.",
      };
    }
    const form = checkedPayuForm(body.form, payuTestOrigin());
    if (!form || typeof body.txnid !== "string" || typeof body.amount !== "number" || form.fields.txnid !== body.txnid) {
      console.error(`[medusa-payu] payu session for cart ${cartId} returned an unusable form`);
      return { ok: false, status: 502, message: "Payment could not be started." };
    }
    return { ok: true, form, txnid: body.txnid, amount: body.amount };
  } catch (err) {
    console.error("[medusa-payu] payu session error for cart", cartId, ":", err);
    return { ok: false, status: 0, message: "Payment could not be started." };
  }
}

/* ── The customer coming back ─────────────────────────────── */

export interface BackendPayuOutcome {
  status: PayuOutcomeStatus;
  orderId: string | null;
  cartId: string | null;
}

const BACKEND_STATUSES = new Set(["order", "pending", "processing", "failed", "refunded"]);

/**
 * Hand PayU's fields to the backend, which checks the hash, asks PayU and
 * completes the cart once paid. Safe to repeat. A 4xx means the fields did not
 * check out (never a success); anything else unanswered is "unavailable".
 */
export async function confirmPayuReturn(fields: PayuReturnFields): Promise<BackendPayuOutcome> {
  try {
    const res = await fetch(`${BASE_URL}/store/payu/return`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify(fields),
      cache: "no-store",
      signal: AbortSignal.timeout(MEDUSA_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as {
      status?: unknown; order_id?: unknown; cart_id?: unknown; message?: unknown;
    };
    if (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 409) {
      console.error(`[medusa-payu] return for ${fields.txnid ?? "?"} refused ${res.status}: ${String(body.message ?? "")}`);
      return { status: "unverified", orderId: null, cartId: null };
    }
    if (!res.ok || typeof body.status !== "string" || !BACKEND_STATUSES.has(body.status)) {
      return { status: "unavailable", orderId: null, cartId: null };
    }
    const status = body.status as PayuOutcomeStatus;
    const orderId = typeof body.order_id === "string" ? body.order_id : null;
    return {
      // An order without its id is not something to show as confirmed.
      status: status === "order" && !orderId ? "processing" : status,
      orderId,
      cartId: typeof body.cart_id === "string" ? body.cart_id : null,
    };
  } catch (err) {
    console.error("[medusa-payu] return error for", fields.txnid ?? "?", ":", err);
    return { status: "unavailable", orderId: null, cartId: null };
  }
}

/* ── The return cookie ────────────────────────────────────── */

export const PAYU_RETURN_COOKIE = "eyra_payu_return";
const COOKIE_PATH = "/api/payu";
const COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

export function setReturnCookie(res: NextResponse, fields: PayuReturnFields): void {
  res.cookies.set(PAYU_RETURN_COOKIE, encodeReturnCookie(fields), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearReturnCookie(res: NextResponse): void {
  res.cookies.set(PAYU_RETURN_COOKIE, "", { httpOnly: true, path: COOKIE_PATH, maxAge: 0 });
}

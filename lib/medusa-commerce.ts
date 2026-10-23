/**
 * Server-only: the backend's launch checkout rules.
 *
 * The Medusa backend decides the shipping charge for how an order is paid, which
 * discount code fits.
 * These helpers ask it to, and hand back the cart as the backend reports it.
 * Nothing here works out a price: amounts are never taken from the browser.
 */
import "server-only";

import type { CartSummary, PaymentMode } from "@/lib/medusa-cart";

const BASE_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

function storeHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(PUB_KEY ? { "x-publishable-api-key": PUB_KEY } : {}),
  };
}

export type CommerceResult =
  | { ok: true; cart: CartSummary }
  | { ok: false; status: number; message: string };

async function post(path: string, body: unknown): Promise<CommerceResult> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as
      | { cart?: CartSummary; message?: string }
      | null;
    if (res.ok && data?.cart) return { ok: true, cart: data.cart };
    return {
      ok: false,
      status: res.status,
      message: data?.message ?? "The cart could not be updated. Please try again.",
    };
  } catch (err) {
    console.error("[medusa-commerce] request failed for", path, ":", err);
    return { ok: false, status: 0, message: "The cart could not be updated. Please try again." };
  }
}

/** The cart as the backend reports it: each line at Medusa's price, and the totals. */
export async function getCartSummary(cartId: string): Promise<CommerceResult> {
  try {
    const res = await fetch(`${BASE_URL}/store/carts/${encodeURIComponent(cartId)}/summary`, {
      headers: storeHeaders(),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as { cart?: CartSummary; message?: string } | null;
    if (res.ok && data?.cart) return { ok: true, cart: data.cart };
    return { ok: false, status: res.status, message: data?.message ?? "The cart could not be read. Please try again." };
  } catch (err) {
    console.error("[medusa-commerce] could not read the cart summary for", cartId, ":", err);
    return { ok: false, status: 0, message: "The cart could not be read. Please try again." };
  }
}

/** Set the shipping charge for how the cart will be paid: free for prepaid, the COD charge for COD. */
export function setCartPaymentMode(cartId: string, mode: PaymentMode): Promise<CommerceResult> {
  return post(`/store/carts/${encodeURIComponent(cartId)}/payment-mode`, { mode });
}

/** Put one discount code on the cart, or take it off with null. The backend says why a code does not fit. */
export function setCartDiscountCode(cartId: string, code: string | null): Promise<CommerceResult> {
  return post(`/store/carts/${encodeURIComponent(cartId)}/discount-code`, { code });
}

/**
 * Set the cart's email, which links it to that customer's account. Needed before
 * a once-per-account code such as WELCOME200 can be applied.
 */
export async function setCartEmail(cartId: string, email: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/store/carts/${encodeURIComponent(cartId)}`, {
      method: "POST",
      headers: storeHeaders(),
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
    return res.ok;
  } catch (err) {
    console.error("[medusa-commerce] could not set the cart email:", err);
    return false;
  }
}

import type { CartSummary } from "@/lib/medusa-cart";

export type PromoResult =
  | { ok: true; cart: CartSummary }
  | { ok: false; message: string };

/** Ask the server to put a discount code on the cart, or take it off with null. Client-only. */
export async function submitPromoCode(cartId: string, code: string | null): Promise<PromoResult> {
  try {
    const res = await fetch("/api/cart/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId, code }),
    });
    const data = (await res.json().catch(() => null)) as
      | { cart?: CartSummary; message?: string }
      | null;
    if (res.ok && data?.cart) return { ok: true, cart: data.cart };
    return { ok: false, message: data?.message ?? "That code could not be applied. Please try again." };
  } catch {
    return { ok: false, message: "That code could not be applied. Please check your connection and try again." };
  }
}

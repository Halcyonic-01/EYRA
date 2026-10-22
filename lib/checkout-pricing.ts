import type { CartSummary, PaymentMode } from "@/lib/medusa-cart";

export type WalletChoice = "on" | "off" | "keep";

export type PricingResult =
  | { ok: true; cart: CartSummary; walletBalance?: number }
  | { ok: false; message: string };

/**
 * Ask the server what the cart costs for how the customer will pay, and to put
 * wallet credit on or off. Client-only. All numbers come back from the backend.
 */
export async function fetchCheckoutPricing(
  cartId: string,
  mode: PaymentMode,
  wallet: WalletChoice = "keep"
): Promise<PricingResult> {
  try {
    const res = await fetch("/api/checkout/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId, mode, wallet }),
    });
    const data = (await res.json().catch(() => null)) as
      | { cart?: CartSummary; walletBalance?: number; message?: string }
      | null;
    if (res.ok && data?.cart) return { ok: true, cart: data.cart, walletBalance: data.walletBalance };
    return { ok: false, message: data?.message ?? "Could not update your total. Please try again." };
  } catch {
    return { ok: false, message: "Could not update your total. Please check your connection and try again." };
  }
}

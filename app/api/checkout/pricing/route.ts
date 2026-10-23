import { NextRequest, NextResponse } from "next/server";

import { applyWalletToCart, removeWalletFromCart } from "@/lib/medusa-wallet";
import { getWalletCustomer } from "@/lib/wallet-customer";
import { getCartSummary, setCartPaymentMode } from "@/lib/medusa-commerce";
import { applyRateLimit } from "@/lib/rateLimit";

type WalletChoice = "on" | "off" | "keep";

/**
 * What the cart costs for how the customer means to pay.
 *
 * Body: { cartId, mode: "prepaid" | "cod", wallet?: "on" | "off" | "keep" }
 *
 * The backend sets the shipping charge for the mode (free for prepaid, the Cash
 * on Delivery charge for COD). Wallet
 * credit is then put on, taken off, or, for "keep", refreshed to match the new
 * total. Every number comes from the backend; nothing is taken from the browser.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, "checkout_pricing", 120);
  if (limited) return limited;

  let body: { cartId?: unknown; mode?: unknown; wallet?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });
  }

  const cartId = typeof body.cartId === "string" ? body.cartId : "";
  if (!cartId.startsWith("cart_")) {
    return NextResponse.json({ error: "invalid_request", message: "Your cart could not be found." }, { status: 400 });
  }
  if (body.mode !== "prepaid" && body.mode !== "cod") {
    return NextResponse.json({ error: "invalid_request", message: "Choose a payment method." }, { status: 400 });
  }
  const wallet: WalletChoice =
    body.wallet === "on" || body.wallet === "off" || body.wallet === "keep" ? body.wallet : "keep";

  const customer = await getWalletCustomer();
  if (wallet === "on" && !customer) {
    return NextResponse.json({ error: "sign_in_required", message: "Sign in to use wallet credit." }, { status: 401 });
  }

  // Wallet credit is a fixed amount, so it goes on after the charge is known.
  let result = await setCartPaymentMode(cartId, body.mode);
  if (!result.ok) {
    return NextResponse.json(
      { error: "pricing_failed", message: result.message },
      { status: result.status >= 500 || result.status === 0 ? 502 : 400 }
    );
  }

  let walletBalance: number | undefined;
  if (customer) {
    const hadCredit = result.cart.totals.wallet_credit > 0;
    if (wallet === "on" || (wallet === "keep" && hadCredit)) {
      const applied = await applyWalletToCart(cartId, customer.customerId);
      if (!applied.ok) {
        return NextResponse.json(
          { error: applied.reason, message: applied.message },
          { status: applied.reason === "failed" ? 502 : 409 }
        );
      }
      walletBalance = applied.walletBalance;
    } else if (wallet === "off" && hadCredit) {
      await removeWalletFromCart(cartId);
    }

    const refreshed = await getCartSummary(cartId);
    if (refreshed.ok) result = refreshed;
  }

  return NextResponse.json({ cart: result.cart, walletBalance });
}

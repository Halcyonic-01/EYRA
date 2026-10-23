import { NextRequest, NextResponse } from "next/server";

import { getCheckoutEmail } from "@/lib/checkout-customer";
import { applyWalletToCart } from "@/lib/medusa-wallet";
import { getWalletCustomer } from "@/lib/wallet-customer";
import { getCartSummary, setCartDiscountCode, setCartEmail } from "@/lib/medusa-commerce";
import { applyRateLimit } from "@/lib/rateLimit";

/**
 * Put one discount code on a cart, or take it off.
 *
 * Body: { cartId, code: string | null }
 *
 * The code, its order-value limits and its once-per-account rule are all
 * decided by the backend. This route only introduces the signed-in customer to
 * the cart, so an account-limited code can be checked, and keeps wallet credit
 * matched to the new total.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, "cart_promo", 60);
  if (limited) return limited;

  let body: { cartId?: unknown; code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });
  }

  const cartId = typeof body.cartId === "string" ? body.cartId : "";
  if (!cartId.startsWith("cart_")) {
    return NextResponse.json({ error: "invalid_request", message: "Your cart could not be found." }, { status: 400 });
  }
  const code = typeof body.code === "string" && body.code.trim() ? body.code.trim().slice(0, 40) : null;

  // A signed-in customer's email links the cart to their account.
  const email = await getCheckoutEmail();
  if (email) await setCartEmail(cartId, email);

  let result = await setCartDiscountCode(cartId, code);
  if (!result.ok) {
    return NextResponse.json(
      { error: "code_refused", message: result.message },
      { status: result.status >= 500 || result.status === 0 ? 502 : 400 }
    );
  }

  // Wallet credit is a fixed amount: if the customer has it on the cart, make it
  // match the new total, so a discount can never leave credit larger than the bill.
  if (result.cart.totals.wallet_credit > 0) {
    const customer = await getWalletCustomer();
    if (customer) {
      await applyWalletToCart(cartId, customer.customerId);
      const refreshed = await getCartSummary(cartId);
      if (refreshed.ok) result = refreshed;
    }
  }

  return NextResponse.json({ cart: result.cart });
}

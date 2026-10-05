import { NextRequest, NextResponse } from "next/server";

import { applyWalletToCart, removeWalletFromCart } from "@/lib/medusa-wallet";
import { getWalletCustomer } from "@/lib/wallet-customer";
import { applyRateLimit } from "@/lib/rateLimit";

/**
 * Turn wallet credit on or off for the cart being checked out.
 *
 * Body: { cartId: string, apply: boolean }
 * Returns the cart's new totals so the checkout can show what is left to pay.
 */
export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req, "wallet_apply", 60);
  if (rateLimitResponse) return rateLimitResponse;

  const { cartId, apply } = (await req.json()) as { cartId?: string; apply?: boolean };
  if (!cartId || typeof apply !== "boolean") {
    return NextResponse.json({ error: "cartId and apply are required" }, { status: 400 });
  }

  const customer = await getWalletCustomer();
  if (!customer) {
    return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  }

  const result = apply
    ? await applyWalletToCart(cartId, customer.customerId)
    : await removeWalletFromCart(cartId);

  if (!result.ok) {
    const status = result.reason === "failed" ? 502 : 409;
    return NextResponse.json({ error: result.reason, message: result.message }, { status });
  }

  return NextResponse.json({
    appliedAmount: result.appliedAmount,
    walletBalance: result.walletBalance,
    totals: result.totals,
  });
}

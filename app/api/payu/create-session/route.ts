import { NextRequest, NextResponse } from "next/server";

import { getCheckoutEmail, SIGN_IN_REQUIRED } from "@/lib/checkout-customer";
import { clearReturnCookie, startPayuCheckout } from "@/lib/medusa-payu";
import { fetchCartSnapshot, prepareCartForCheckout, type CheckoutShippingAddress } from "@/lib/medusa-order";
import { syncWalletForCheckout } from "@/lib/medusa-wallet";
import { payuEnabled } from "@/lib/payu";
import { applyRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/payu/create-session  { cartId, shippingAddress, useWallet }
 *
 * Prepares the cart like the Razorpay route does, then asks the backend to open
 * a PayU attempt. Answers with the signed hosted-checkout form the browser posts
 * to PayU. The amount, transaction id and hash all come from the backend.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, "payu_create_session", 10);
  if (limited) return limited;

  if (!payuEnabled()) {
    return NextResponse.json({ error: "payu_unavailable", message: "PayU is not available right now." }, { status: 200 });
  }

  try {
    // The order's email comes from the signed-in user, never from the request.
    const email = await getCheckoutEmail();
    if (!email) return NextResponse.json(SIGN_IN_REQUIRED, { status: 401 });

    const { cartId, shippingAddress, useWallet } = (await req.json().catch(() => ({}))) as {
      cartId?: unknown;
      shippingAddress?: CheckoutShippingAddress;
      useWallet?: unknown;
    };
    if (typeof cartId !== "string" || !cartId || !shippingAddress || typeof shippingAddress !== "object") {
      return NextResponse.json({ error: "cartId and shippingAddress are required" }, { status: 400 });
    }

    // PayU orders are prepaid: free shipping, same as Razorpay.
    if (!(await prepareCartForCheckout(cartId, email, shippingAddress, "prepaid"))) {
      return NextResponse.json({ error: "cart_preparation_failed" }, { status: 200 });
    }

    const wallet = await syncWalletForCheckout(cartId, useWallet === true);
    if (!wallet.ok) {
      return NextResponse.json({ error: "wallet_unavailable", message: wallet.message }, { status: 200 });
    }

    // PayU cannot charge zero; that is a wallet-only order.
    const snapshot = await fetchCartSnapshot(cartId);
    if (snapshot && snapshot.total <= 0) {
      return NextResponse.json({ error: "fully_covered_by_wallet" }, { status: 200 });
    }

    const started = await startPayuCheckout(cartId);
    if (!started.ok) {
      // A 4xx is the backend saying no (prices changed, already paid, another payment pending); say why.
      const refused = started.status >= 400 && started.status < 500;
      return NextResponse.json(
        { error: refused ? "checkout_refused" : "payment_session_failed", message: refused ? started.message : undefined },
        { status: 200 }
      );
    }

    const res = NextResponse.json({ form: started.form, txnid: started.txnid, amount: started.amount });
    // A return from an earlier attempt must not be read as this one's.
    clearReturnCookie(res);
    return res;
  } catch (err) {
    console.error("[payu/create-session]", err);
    return NextResponse.json({ error: "internal" }, { status: 200 });
  }
}

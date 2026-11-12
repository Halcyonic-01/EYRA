import { NextRequest, NextResponse } from "next/server";
import { rememberCartForRazorpayOrder } from "@/lib/razorpay-store";
import {
  prepareCartForCheckout,
  fetchCartSnapshot,
  startRazorpayCheckout,
  type CheckoutShippingAddress,
} from "@/lib/medusa-order";
import { syncWalletForCheckout } from "@/lib/medusa-wallet";
import { applyRateLimit } from "@/lib/rateLimit";
import { getCheckoutEmail, SIGN_IN_REQUIRED } from "@/lib/checkout-customer";

export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req, "razorpay_create_order", 10);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // The order's email comes from the signed-in user, never from the request.
    const email = await getCheckoutEmail();
    if (!email) return NextResponse.json(SIGN_IN_REQUIRED, { status: 401 });

    const { cartId, shippingAddress, useWallet } = (await req.json()) as {
      cartId?: string;
      shippingAddress?: CheckoutShippingAddress;
      useWallet?: boolean;
    };

    if (!cartId || !shippingAddress) {
      return NextResponse.json(
        { error: "cartId and shippingAddress are required" },
        { status: 400 }
      );
    }

    // Step 1, set email/shipping address and select a shipping method.
    // Required before Medusa will allow the cart to complete.
    const prepared = await prepareCartForCheckout(cartId, email, shippingAddress, "prepaid");
    if (!prepared) {
      return NextResponse.json(
        { razorpayOrderId: null, error: "cart_preparation_failed" },
        { status: 200 }
      );
    }

    // Wallet credit is decided after shipping is on the cart, so it can cover
    // the delivery charge too, and switched-off credit is cleared.
    const wallet = await syncWalletForCheckout(cartId, useWallet === true);
    if (!wallet.ok) {
      return NextResponse.json(
        { razorpayOrderId: null, error: "wallet_unavailable", message: wallet.message },
        { status: 200 }
      );
    }

    // Razorpay cannot charge zero. Wallet credit that covers everything is a
    // wallet-only order, which has its own route.
    const snapshot = await fetchCartSnapshot(cartId);
    if (snapshot && snapshot.total <= 0) {
      return NextResponse.json(
        { razorpayOrderId: null, error: "fully_covered_by_wallet" },
        { status: 200 }
      );
    }

    // Step 2, open the Razorpay payment. The backend reprices the cart to
    // today's prices and records what this payment is for, so the customer
    // keeps that price even if a sale ends while they pay. The amount and the
    // Razorpay order both come from the backend, never from the browser.
    const started = await startRazorpayCheckout(cartId);
    if (!started.ok) {
      // A 4xx is the backend saying no (prices changed, already paid); say why.
      const refused = started.status >= 400 && started.status < 500;
      return NextResponse.json(
        {
          razorpayOrderId: null,
          error: refused ? "checkout_refused" : "payment_session_failed",
          message: refused ? started.message : undefined,
        },
        { status: 200 }
      );
    }
    const razorpayOrderId = started.razorpayOrderId;

    // Bind the Razorpay order to this cart while both IDs are server-derived.
    // /api/razorpay/webhook relies on this to recover an order when the
    // customer's browser never makes it back to /api/razorpay/verify.
    await rememberCartForRazorpayOrder(razorpayOrderId, cartId);

    return NextResponse.json({
      razorpayOrderId,
      collectionId: started.collectionId,
      sessionId: started.sessionId,
      // What Razorpay will actually charge, after any wallet credit.
      amount: started.amount,
    });
  } catch (err) {
    console.error("[razorpay/create-order]", err);
    // Non-critical, frontend will fall back to amount-only checkout
    return NextResponse.json({ razorpayOrderId: null, error: "internal" }, { status: 200 });
  }
}

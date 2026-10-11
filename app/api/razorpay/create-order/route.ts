import { NextRequest, NextResponse } from "next/server";
import { rememberCartForRazorpayOrder } from "@/lib/razorpay-store";
import {
  prepareCartForCheckout,
  createPaymentCollection,
  initPaymentSession,
  fetchCartSnapshot,
  type CheckoutShippingAddress,
} from "@/lib/medusa-order";
import { syncWalletForCheckout } from "@/lib/medusa-wallet";
import { applyRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req, "razorpay_create_order", 10);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { cartId, email, shippingAddress, useWallet } = (await req.json()) as {
      cartId?: string;
      email?: string;
      shippingAddress?: CheckoutShippingAddress;
      useWallet?: boolean;
    };

    if (!cartId || !email || !shippingAddress) {
      return NextResponse.json(
        { error: "cartId, email, and shippingAddress are required" },
        { status: 400 }
      );
    }

    // Step 1, set email/shipping address and select a shipping method.
    // Required before Medusa will allow the cart to complete.
    const prepared = await prepareCartForCheckout(cartId, email, shippingAddress);
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

    // Step 2, create (or reuse) the payment collection for this cart
    const collectionId = await createPaymentCollection(cartId);

    if (!collectionId) {
      return NextResponse.json(
        { razorpayOrderId: null, error: "payment_collection_failed" },
        { status: 200 }
      );
    }

    // Step 3, initialize a Razorpay payment session on the collection
    const collection = await initPaymentSession(collectionId, "pp_razorpay_razorpay");
    const session = collection?.payment_sessions?.find(
      (s) => s.provider_id === "pp_razorpay_razorpay"
    );

    // The Razorpay order_id lives at session.data.razorpayOrder.id (confirmed
    // against the plugin's actual response shape, not session.data.id).
    const razorpayOrder = session?.data?.razorpayOrder as { id?: unknown } | undefined;
    const razorpayOrderId =
      typeof razorpayOrder?.id === "string" ? razorpayOrder.id : null;

    // Bind the Razorpay order to this cart while both IDs are server-derived.
    // /api/razorpay/webhook relies on this to recover an order when the
    // customer's browser never makes it back to /api/razorpay/verify.
    if (razorpayOrderId) {
      await rememberCartForRazorpayOrder(razorpayOrderId, cartId);
    }

    return NextResponse.json({
      razorpayOrderId,
      collectionId,
      sessionId: session?.id ?? null,
      // What Razorpay will actually charge, after any wallet credit.
      amount: collection?.amount ?? snapshot?.total ?? null,
    });
  } catch (err) {
    console.error("[razorpay/create-order]", err);
    // Non-critical, frontend will fall back to amount-only checkout
    return NextResponse.json({ razorpayOrderId: null, error: "internal" }, { status: 200 });
  }
}

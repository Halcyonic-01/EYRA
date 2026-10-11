import { NextRequest, NextResponse } from "next/server";
import {
  prepareCartForCheckout,
  createPaymentCollection,
  initPaymentSession,
  completeCart,
  fetchCartSnapshot,
  type CheckoutShippingAddress,
} from "@/lib/medusa-order";
import { syncWalletForCheckout } from "@/lib/medusa-wallet";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import { applyRateLimit } from "@/lib/rateLimit";

/**
 * Complete a Cash-on-Delivery cart into a real Medusa order.
 *
 * COD takes no upfront payment, but Medusa's cart-completion workflow still
 * requires an initialized payment session before it will produce an order,
 * `pp_system_default` (Medusa's built-in manual/no-op provider) is exactly
 * what this is for.
 */
export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req, "cod_complete", 10);
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

    const prepared = await prepareCartForCheckout(cartId, email, shippingAddress);
    if (!prepared) {
      return NextResponse.json({ orderId: null, error: "cart_preparation_failed" }, { status: 200 });
    }

    // Wallet credit is decided after shipping is on the cart, so it can cover
    // the delivery charge too, and switched-off credit is cleared.
    const wallet = await syncWalletForCheckout(cartId, useWallet === true);
    if (!wallet.ok) {
      return NextResponse.json(
        { orderId: null, error: "wallet_unavailable", message: wallet.message },
        { status: 200 }
      );
    }

    // Nothing left to collect: this is a wallet-only order, not a COD one.
    const snapshot = await fetchCartSnapshot(cartId);
    if (snapshot && snapshot.total <= 0) {
      return NextResponse.json({ orderId: null, error: "fully_covered_by_wallet" }, { status: 200 });
    }

    const collectionId = await createPaymentCollection(cartId);
    if (!collectionId) {
      return NextResponse.json({ orderId: null, error: "payment_collection_failed" }, { status: 200 });
    }

    const collection = await initPaymentSession(collectionId, "pp_system_default");
    if (!collection) {
      return NextResponse.json({ orderId: null, error: "payment_session_failed" }, { status: 200 });
    }

    const { orderId } = await completeCart(cartId);
    if (!orderId) {
      return NextResponse.json({ orderId: null, error: "completion_failed" }, { status: 200 });
    }

    await sendOrderConfirmationEmail(orderId);

    return NextResponse.json({ orderId });
  } catch (err) {
    console.error("[cod/complete]", err);
    return NextResponse.json({ orderId: null, error: "internal" }, { status: 200 });
  }
}

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
 * Place an order that wallet credit pays for in full.
 *
 * Nothing is charged: Medusa still needs an initialized payment session before
 * it will produce an order, and `pp_system_default` (its built-in no-op
 * provider) is for exactly that. This route refuses to run unless the wallet
 * really does cover the whole cart, so it can never be used to skip payment.
 */
export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req, "wallet_pay", 10);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { cartId, email, shippingAddress } = (await req.json()) as {
      cartId?: string;
      email?: string;
      shippingAddress?: CheckoutShippingAddress;
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

    const wallet = await syncWalletForCheckout(cartId, true);
    if (!wallet.ok) {
      return NextResponse.json(
        { orderId: null, error: "wallet_unavailable", message: wallet.message },
        { status: 200 }
      );
    }

    // Safety check: only a cart with nothing left to pay may skip payment.
    const snapshot = await fetchCartSnapshot(cartId);
    if (!snapshot || snapshot.total > 0) {
      return NextResponse.json({ orderId: null, error: "wallet_not_enough" }, { status: 200 });
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
    console.error("[wallet/pay]", err);
    return NextResponse.json({ orderId: null, error: "internal" }, { status: 200 });
  }
}

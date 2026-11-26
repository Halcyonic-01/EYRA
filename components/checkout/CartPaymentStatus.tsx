"use client";

import Link from "next/link";

import { PaymentStandingPanel } from "@/components/checkout/PaymentStandingPanel";
import { useCartStore } from "@/store/useStore";
import { standingView } from "@/lib/payment-standing";
import { usePaymentStanding } from "@/lib/use-payment-standing";

/**
 * "Where's my payment?" for the cart in this browser: confirming, still at the
 * bank, refunds on their way, or nothing outstanding. Linked from checkout
 * messages, so a customer who closed the payment window can see what happened
 * before deciding whether to pay.
 */
export function CartPaymentStatus() {
  const cartId = useCartStore((s) => s.cartId);
  const { standing, checking, refresh } = usePaymentStanding(cartId, true);
  const clear = standing && !standingView(standing);

  return (
    <div className="max-w-[560px] mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col gap-6" data-testid="cart-payment-status">
      <div className="flex flex-col gap-2">
        <h1 className="font-sans font-medium text-[26px] sm:text-[30px] text-black">Payment status</h1>
        <p className="font-sans text-[15px] leading-[23px] text-[#626262]">
          Where the payment for your current cart stands, checked with Razorpay and PayU just now.
        </p>
      </div>

      {!cartId && (
        <p className="font-sans text-[15px] text-[#626262]" data-testid="payment-status-no-cart">
          There&apos;s no cart in this browser. If you paid on another device, your order and any refund show in your orders.
        </p>
      )}

      {cartId && !standing && checking && (
        <p className="font-sans text-[15px] text-[#626262]">Checking your payment…</p>
      )}

      <PaymentStandingPanel standing={standing} checking={checking} onCheckAgain={() => void refresh()} helpLink={false} />

      {clear && (
        <p className="font-sans text-[15px] text-[#626262]" data-testid="payment-status-clear">
          No payment has been taken or is in progress for this cart. You can pay for it at checkout as usual.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {(clear || standing?.can_pay) && (
          <Link href="/checkout" className="min-h-[48px] inline-flex items-center px-8 rounded-full bg-black text-white font-sans font-medium text-[16px]">
            Go to checkout
          </Link>
        )}
        <Link href="/orders" className="min-h-[48px] inline-flex items-center px-8 rounded-full border border-[#CFCFCF] text-black font-sans font-medium text-[16px]">
          My orders
        </Link>
        <Link href="/contact" className="min-h-[48px] inline-flex items-center px-8 rounded-full border border-[#CFCFCF] text-black font-sans font-medium text-[16px]">
          Contact support
        </Link>
      </div>
    </div>
  );
}

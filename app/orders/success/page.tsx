import type { Metadata } from "next";
import Link from "next/link";

import { formatRupees } from "@/lib/money";

export const metadata: Metadata = {
  title: "Order Confirmed",
  description: "Your EYRA order has been placed successfully.",
};

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    orderId?: string;
    method?: string;
    wallet?: string;
    payment_id?: string;
    awb?: string;
    courier?: string;
  }>;
}) {
  const { orderId, method, wallet, payment_id, awb, courier } = await searchParams;
  const isPrepaid = method === "prepaid";
  const isWalletOnly = method === "wallet";
  // Wallet credit used, when any. Display only: the order itself is the record.
  const walletCredit = Number(wallet) > 0 ? Number(wallet) : 0;

  if (!orderId) {
    return (
      <div className="max-w-screen-xl mx-auto px-6 py-24 flex flex-col items-center gap-6 text-center">
        <p className="font-sans font-normal text-[18px] text-[#909090]">
          No order found. Please check your inbox for a confirmation.
        </p>
        <Link
          href="/products"
          className="px-8 py-[14px] bg-black text-white font-sans font-medium text-[16px] rounded-full hover:bg-[#1a1a1a] transition-colors duration-200"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-20 flex flex-col items-center gap-8 text-center">

      {/* Checkmark circle */}
      <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      {/* Heading */}
      <div className="flex flex-col gap-2">
        <h1 className="font-sans font-medium text-[30px] text-black">
          Order Confirmed!
        </h1>
        <p className="font-sans font-normal text-[16px] text-[#626262] max-w-[440px]">
          {isWalletOnly
            ? "Paid in full with your wallet credit. Your order is now queued for crafting."
            : isPrepaid
            ? "Payment received. Your order is now queued for crafting."
            : "We'll collect payment when your order arrives at your door."}
        </p>
      </div>

      {/* Order details card */}
      <div className="w-full max-w-[440px] flex flex-col gap-4 px-8 py-6 bg-[#F7F7F7] rounded-2xl text-left">
        <div className="flex flex-col gap-1">
          <span className="font-sans font-normal text-[12px] text-[#909090] uppercase tracking-wide">Order ID</span>
          <span className="font-sans font-medium text-[18px] text-black tracking-wide">{orderId}</span>
        </div>

        <div className="h-px bg-[#E8E8E8]" />

        <div className="flex flex-col gap-1">
          <span className="font-sans font-normal text-[12px] text-[#909090] uppercase tracking-wide">Payment</span>
          <span className="font-sans font-medium text-[15px] text-black">
            {isWalletOnly
              ? "Paid with wallet credit"
              : isPrepaid
              ? "Prepaid via Razorpay"
              : "Cash on Delivery"}
          </span>
        </div>

        {walletCredit > 0 && !isWalletOnly && (
          <>
            <div className="h-px bg-[#E8E8E8]" />
            <div className="flex flex-col gap-1">
              <span className="font-sans font-normal text-[12px] text-[#909090] uppercase tracking-wide">
                Wallet credit used
              </span>
              <span className="font-sans font-medium text-[15px] text-black">
                {formatRupees(walletCredit)}
              </span>
            </div>
          </>
        )}

        {isPrepaid && payment_id && (
          <>
            <div className="h-px bg-[#E8E8E8]" />
            <div className="flex flex-col gap-1">
              <span className="font-sans font-normal text-[12px] text-[#909090] uppercase tracking-wide">
                Transaction ID
              </span>
              <span className="font-sans font-normal text-[13px] text-[#626262] break-all">
                {payment_id}
              </span>
            </div>
          </>
        )}

        {awb && (
          <>
            <div className="h-px bg-[#E8E8E8]" />
            <div className="flex flex-col gap-1">
              <span className="font-sans font-normal text-[12px] text-[#909090] uppercase tracking-wide">
                Tracking Number (AWB)
              </span>
              <span className="font-sans font-medium text-[15px] text-black tracking-wider">
                {awb}
              </span>
              {courier && (
                <span className="font-sans font-normal text-[12px] text-[#626262]">
                  via {courier}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Fulfilment note */}
      <div className="flex items-start gap-3 max-w-[440px] p-4 bg-[#FFFDF0] border border-[#E8D87A] rounded-2xl text-left">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="mt-0.5 flex-shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" stroke="#B8960C" strokeWidth="1.5" />
          <path d="M12 7v5M12 16.5v.5" stroke="#B8960C" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="font-sans font-normal text-[13px] text-[#7A6200] leading-[20px]">
          Made to order. Each piece is handcrafted within 7 to 10 business days.
          A confirmation will be sent to your registered email.
        </p>
      </div>

      {/* CTAs */}
      <div className="flex gap-3 flex-wrap justify-center">
        <Link
          href="/products"
          className="px-8 py-[14px] bg-black text-white font-sans font-medium text-[16px] rounded-full hover:bg-[#1a1a1a] transition-colors duration-200"
          style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
        >
          Continue Shopping
        </Link>
        <Link
          href="/"
          className="px-8 py-[14px] border border-[#CFCFCF] text-black font-sans font-medium text-[16px] rounded-full hover:bg-[#F7F7F7] transition-colors duration-200"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

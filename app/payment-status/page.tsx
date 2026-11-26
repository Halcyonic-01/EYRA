import type { Metadata } from "next";

import { CartPaymentStatus } from "@/components/checkout/CartPaymentStatus";

export const metadata: Metadata = {
  title: "Payment Status",
  description: "Where your payment for this cart stands.",
  robots: { index: false, follow: false },
};

// Not behind sign-in: it only shows the payment of the cart this browser holds.
export default function PaymentStatusPage() {
  return <CartPaymentStatus />;
}

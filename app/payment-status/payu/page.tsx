import type { Metadata } from "next";

import { PayuStatus } from "@/components/checkout/PayuStatus";

export const metadata: Metadata = {
  title: "Payment Status",
  description: "Confirming your PayU payment.",
  robots: { index: false, follow: false },
};

// Not behind sign-in on purpose: PayU's cross-site return may arrive before the
// session cookie does, and the page shows nothing beyond the payment's status.
export default function PayuStatusPage() {
  return <PayuStatus />;
}

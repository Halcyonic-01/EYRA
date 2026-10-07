import Link from "next/link";

import type { CancellationSummary } from "@/lib/cancellation";
import { cancelReasonLabel } from "@/lib/cancellation";
import { formatRupees } from "@/lib/money";

function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

interface Props {
  summary: CancellationSummary;
  eta: string;
  validMonths: number;
}

/** What happened to a cancelled order, and where the refund went. */
export default function CancellationBanner({ summary, eta, validMonths }: Props) {
  const stillFinishing = summary.refund_status === "failed" || summary.refund_status === "pending";

  const lines: string[] = [];
  if (summary.refund_method === "wallet" && !stillFinishing) {
    lines.push(
      `${formatRupees(summary.refund_amount)} was refunded to your EYRA wallet (100% of what you paid)${
        summary.wallet_expires_at ? `, valid until ${longDate(summary.wallet_expires_at)}` : `, valid for ${validMonths} months`
      }.`
    );
  } else if (summary.refund_method === "original" && !stillFinishing) {
    lines.push(
      `Your refund of ${formatRupees(summary.refund_amount)} has started and will reach your original payment method in ${eta}. A ${formatRupees(summary.fee)} cancellation fee was kept.`
    );
  } else if (stillFinishing && summary.paid_online > 0) {
    lines.push("We are finishing your refund and will email you as soon as it is done.");
  } else {
    lines.push("No payment was taken, so there was nothing to refund.");
  }
  if (summary.wallet_used > 0) {
    lines.push(`The ${formatRupees(summary.wallet_used)} of wallet credit you used was returned to your wallet.`);
  }

  const toWallet = summary.refund_method === "wallet" || summary.wallet_used > 0;

  return (
    <div className="mb-6 rounded-2xl border border-[#E1E1E1] bg-[#FAFAFA] px-5 py-4">
      <div className="flex gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-shrink-0">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12.5l2.7 2.7L16 9.5" />
        </svg>
        <div>
          <p className="font-sans text-[15px] font-medium text-black">Order cancelled</p>
          {lines.map((line) => (
            <p key={line} className="mt-1 font-sans text-[13px] leading-relaxed text-[#444]">
              {line}
            </p>
          ))}
          <p className="mt-2 font-sans text-[12px] text-[#909090]">
            Reason: {cancelReasonLabel(summary.reason)}
          </p>
          {toWallet && (
            <Link href="/wallet" className="mt-3 inline-block font-sans text-[13px] text-black underline underline-offset-2">
              View your wallet
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

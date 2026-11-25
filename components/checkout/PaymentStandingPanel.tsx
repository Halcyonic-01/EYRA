"use client";

import Link from "next/link";

import { refundLine, standingView, type PaymentStanding } from "@/lib/payment-standing";

const TONES = {
  good: { box: "bg-[#F7FFF4] border-[#C8EEB8]", title: "text-[#2F6B12]", icon: "#47B10A" },
  warning: { box: "bg-[#FFFBEB] border-[#F0D98A]", title: "text-[#7A5A00]", icon: "#B8860B" },
  neutral: { box: "bg-[#F7F7F7] border-[#E1E1E1]", title: "text-black", icon: "#626262" },
} as const;

/**
 * Where the cart's payment stands, in the customer's words: confirming,
 * still in progress at the bank (with when they may try again), could not be
 * checked, already an order, or refunds on their way. Nothing when all is clear.
 */
export function PaymentStandingPanel({
  standing,
  checking,
  onCheckAgain,
  now,
  helpLink = true,
}: {
  standing: PaymentStanding | null;
  checking: boolean;
  onCheckAgain?: () => void;
  now?: Date;
  /** Link to the payment status page (off on that page itself). */
  helpLink?: boolean;
}) {
  const view = standingView(standing, now);
  if (!view || !standing) return null;
  const tone = TONES[view.tone];

  return (
    <div
      className={`flex flex-col gap-3 p-4 border rounded-2xl ${tone.box}`}
      data-testid={`payment-standing-${standing.state}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke={tone.icon} strokeWidth="1.6" />
          {view.tone === "good" ? (
            <path d="M8.5 12.5l2.5 2.5 4.5-5" stroke={tone.icon} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M12 7.5v5.5M12 16.2v.3" stroke={tone.icon} strokeWidth="1.6" strokeLinecap="round" />
          )}
        </svg>
        <div className="flex flex-col gap-1 min-w-0">
          <p className={`font-sans font-medium text-[14px] leading-[20px] ${tone.title}`}>{view.title}</p>
          <p className="font-sans text-[13px] leading-[20px] text-[#444]" data-testid="payment-standing-message">{view.message}</p>
        </div>
      </div>

      {standing.refunds.length > 0 && (
        <ul className="flex flex-col gap-1.5 pl-[30px]" data-testid="payment-standing-refunds">
          {standing.refunds.map((refund, i) => (
            <li key={i} className="font-sans text-[13px] leading-[19px] text-[#444]">{refundLine(refund)}</li>
          ))}
        </ul>
      )}

      {(view.recheck || standing.state === "ordered") && (
        <div className="flex flex-wrap items-center gap-2 pl-[30px]">
          {view.recheck && onCheckAgain && (
            <button
              type="button"
              onClick={onCheckAgain}
              disabled={checking}
              className="min-h-[44px] px-5 rounded-full border border-[#CFCFCF] bg-white font-sans font-medium text-[14px] text-black hover:bg-[#F7F7F7] disabled:opacity-50"
              data-testid="payment-standing-recheck"
            >
              {checking ? "Checking…" : "Check again"}
            </button>
          )}
          {view.recheck && helpLink && (
            <Link href="/payment-status" className="font-sans text-[13px] text-black underline underline-offset-2" data-testid="payment-standing-help">
              What does this mean?
            </Link>
          )}
          {standing.state === "ordered" && (
            <Link
              href="/orders"
              className="min-h-[44px] inline-flex items-center px-5 rounded-full bg-black text-white font-sans font-medium text-[14px]"
            >
              View my orders
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

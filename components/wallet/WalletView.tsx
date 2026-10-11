import Link from "next/link";

import type { WalletTransaction } from "@/lib/medusa-wallet";
import { formatRupees } from "@/lib/money";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Credit rows add to the balance; the others take away from it. */
function adds(t: WalletTransaction): boolean {
  return t.type === "issued" || t.type === "refunded";
}

function describe(t: WalletTransaction): string {
  if (t.type === "redeemed") return "Used at checkout";
  if (t.type === "expired") return "Credit expired";
  if (t.type === "refunded") return "Returned after a cancelled order";
  if (t.reason === "exchange") return "Credit for an exchange";
  return "Credit for a return";
}

/** "Valid until 4 Apr 2027", with how much is left when some was spent. */
function validity(t: WalletTransaction): string | null {
  if (!adds(t) || !t.expiresAt) return null;
  const until = `Valid until ${formatDate(t.expiresAt)}`;
  if (t.remaining <= 0) return `${until} · fully used`;
  return t.remaining < t.amount
    ? `${until} · ${formatRupees(t.remaining)} left`
    : until;
}

const STEPS = [
  {
    title: "Return or exchange",
    body: "When we approve your return or exchange, the credit is added here.",
  },
  {
    title: "Use it at checkout",
    body: "Switch on wallet credit on the payment step of any order.",
  },
  {
    title: "Pay what is left",
    body: "Your credit is used first. Pay any remainder the usual way.",
  },
];

export function WalletView({
  balance,
  nextExpiry,
  validityMonths,
  transactions,
  loadFailed,
}: {
  balance: number;
  /** The credit that lapses first, when any credit has an expiry date. */
  nextExpiry: { amount: number; expiresAt: string } | null;
  /** How long new credit is valid for; 0 means it never expires. */
  validityMonths: number;
  transactions: WalletTransaction[];
  loadFailed: boolean;
}) {
  return (
    <div className="max-w-screen-lg mx-auto px-6 lg:px-10 py-12">
      {/* Header */}
      <div className="mb-8">
        <p className="font-sans font-light tracking-[0.3em] uppercase text-[0.78rem] text-[#909090] mb-1">
          Account
        </p>
        <h1 className="font-sans font-medium text-[26px] text-black">Wallet</h1>
      </div>

      {/* Quick nav */}
      <div className="flex gap-4 mb-8 flex-wrap">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E1E1E1] font-sans text-[13px] text-[#626262] hover:border-[#AAAAAA] hover:text-black transition-colors duration-200"
        >
          My Orders
        </Link>
        <Link
          href="/account"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E1E1E1] font-sans text-[13px] text-[#626262] hover:border-[#AAAAAA] hover:text-black transition-colors duration-200"
        >
          Profile
        </Link>
      </div>

      {loadFailed && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-[#F3C9C5] bg-[#FDF3F2] px-5 py-4 font-sans text-[13px] text-[#B3261E]"
        >
          We could not load your wallet just now. Please refresh the page in a moment.
        </div>
      )}

      {/* Balance */}
      <section
        aria-label="Wallet balance"
        className="rounded-2xl bg-black text-white px-7 py-8 sm:px-10 sm:py-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6"
      >
        <div>
          <p className="font-sans font-light tracking-[0.25em] uppercase text-[0.72rem] text-white/60 mb-3">
            Available credit
          </p>
          <p className="font-sans font-medium text-[44px] leading-none">
            {loadFailed ? "-" : formatRupees(balance)}
          </p>
          {nextExpiry && !loadFailed && (
            <p className="font-sans font-medium text-[13px] text-[#F5C26B] mt-3">
              {formatRupees(nextExpiry.amount)} expires on {formatDate(nextExpiry.expiresAt)}
            </p>
          )}
          <p className="font-sans font-normal text-[13px] text-white/60 mt-3 max-w-md">
            Store credit from your returns and exchanges.{" "}
            {validityMonths > 0
              ? `Credit is valid for ${validityMonths} months from the day it is issued, and the credit that expires first is used first. `
              : ""}
            It is only used when you choose to apply it at checkout.
          </p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center justify-center h-[48px] px-8 rounded-full bg-white text-black font-sans font-medium text-[14px] hover:bg-[#EBEBEB] transition-colors duration-200 self-start sm:self-auto"
        >
          Shop with credit
        </Link>
      </section>

      {/* How it works */}
      <section aria-label="How wallet credit works" className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STEPS.map((step, i) => (
          <div key={step.title} className="rounded-2xl border border-[#E1E1E1] bg-white px-5 py-5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#F0F0F0] font-sans font-medium text-[12px] text-black mb-3">
              {i + 1}
            </span>
            <p className="font-sans font-medium text-[14px] text-black mb-1">{step.title}</p>
            <p className="font-sans font-normal text-[13px] text-[#626262] leading-[19px]">{step.body}</p>
          </div>
        ))}
      </section>

      {/* History */}
      <section aria-label="Wallet activity" className="mt-10">
        <h2 className="font-sans font-medium text-[18px] text-black mb-4">Activity</h2>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center rounded-2xl border border-[#E1E1E1]">
            <div className="w-14 h-14 rounded-full bg-[#F7F7F7] flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#CFCFCF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h13v4" />
                <path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z" />
                <circle cx="16" cy="14.5" r="1" />
              </svg>
            </div>
            <p className="font-sans font-medium text-[16px] text-black">No wallet activity yet</p>
            <p className="font-sans font-normal text-[13px] text-[#909090] max-w-sm">
              When a return or exchange is approved, your credit and every time you use it will show up here.
            </p>
          </div>
        ) : (
          <ul className="rounded-2xl border border-[#E1E1E1] bg-white divide-y divide-[#F0F0F0] overflow-hidden">
            {transactions.map((t) => {
              const added = adds(t);
              return (
                <li key={t.id} className="flex items-center gap-4 px-5 py-4">
                  <span
                    aria-hidden="true"
                    className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-sans font-medium text-[16px] ${
                      t.type === "expired"
                        ? "bg-[#FFF4E0] text-[#B26B00]"
                        : added
                        ? "bg-[#F0FBE8] text-[#3D7A1A]"
                        : "bg-[#F0F0F0] text-[#444]"
                    }`}
                  >
                    {t.type === "expired" ? "!" : added ? "+" : "−"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans font-medium text-[14px] text-black">{describe(t)}</p>
                    <p className="font-sans font-normal text-[12px] text-[#909090] break-words">
                      {formatDate(t.createdAt)}
                      {validity(t) ? ` · ${validity(t)}` : ""}
                      {t.note ? ` · ${t.note}` : ""}
                      {t.orderId && (
                        <>
                          {" · "}
                          <Link href={`/orders/${t.orderId}`} className="underline underline-offset-2 hover:text-black">
                            View order
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-sans font-semibold text-[15px] ${added ? "text-[#3D7A1A]" : t.type === "expired" ? "text-[#B26B00]" : "text-black"}`}>
                      {added ? "+" : "−"}{formatRupees(t.amount)}
                    </p>
                    <p className="font-sans font-normal text-[11px] text-[#909090]">
                      Balance {formatRupees(t.balanceAfter)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

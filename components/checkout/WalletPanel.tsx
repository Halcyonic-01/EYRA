"use client";

import { formatRupees } from "@/lib/money";

/** Checkout toggle for spending wallet credit on this order. */
export function WalletPanel({
  balance, applied, busy, error, onToggle,
}: {
  balance: number; applied: number; busy: boolean; error: string;
  onToggle: (on: boolean) => void;
}) {
  const on = applied > 0;
  return (
    <div className={`rounded-2xl border-2 p-5 transition-colors duration-150 ${on ? "border-black bg-[#FAFAFA]" : "border-[#E1E1E1]"}`}>
      <label className="flex items-start gap-4 cursor-pointer">
        <input
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-1 w-4 h-4 accent-black flex-shrink-0"
        />
        <div className="flex-1">
          <p className="font-sans font-medium text-[16px] text-black">Use wallet credit</p>
          <p className="font-sans font-normal text-[13px] text-[#626262] mt-1">
            {on
              ? `${formatRupees(applied)} of your ${formatRupees(balance)} credit is applied to this order.`
              : `${formatRupees(balance)} available from your returns and exchanges.`}
          </p>
        </div>
        {busy && <div className="w-4 h-4 mt-1 border-2 border-[#CFCFCF] border-t-black rounded-full animate-spin flex-shrink-0" aria-hidden="true" />}
      </label>
      {error && <p role="alert" className="font-sans text-[13px] text-[#D93025] mt-3">{error}</p>}
    </div>
  );
}

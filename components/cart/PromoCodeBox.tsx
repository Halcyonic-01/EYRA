"use client";

import { useState } from "react";
import { submitPromoCode } from "@/lib/cart-promo";
import { useCartStore } from "@/store/useStore";
import { rupees } from "@/config/offers";

/**
 * Enter a discount code. One code at a time: a new code replaces the old one,
 * and the server says plainly why a code does not fit the order.
 */
export function PromoCodeBox() {
  const cartId = useCartStore((s) => s.cartId);
  const totals = useCartStore((s) => s.serverTotals);
  const applySummary = useCartStore((s) => s.applySummary);
  const notice = useCartStore((s) => s.promoNotice);
  const clearNotice = useCartStore((s) => s.clearPromoNotice);

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const applied = totals?.promoCodes[0] ?? null;

  async function run(next: string | null) {
    if (!cartId || busy) return;
    setBusy(true);
    setError("");
    clearNotice();
    const result = await submitPromoCode(cartId, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    applySummary(result.cart);
    setCode("");
  }

  return (
    <div className="flex flex-col gap-2">
      {applied ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[#47B10A] bg-white px-3 py-2.5">
          <div className="min-w-0">
            <p className="font-sans text-[13px] font-medium text-black">{applied} applied</p>
            <p className="font-sans text-[12px] text-[#626262]">
              You save {rupees(totals?.discountTotal ?? 0)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => run(null)}
            disabled={busy}
            className="font-sans text-[13px] text-[#626262] underline underline-offset-2 hover:text-black disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) run(code.trim());
          }}
          className="flex gap-2"
        >
          <label htmlFor="promo-code" className="sr-only">
            Discount code
          </label>
          <input
            id="promo-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Discount code"
            autoComplete="off"
            maxLength={40}
            disabled={!cartId}
            className="min-w-0 flex-1 rounded-xl border border-[#CFCFCF] bg-white px-3 py-2.5 font-mono text-[13px] tracking-[0.08em] text-black placeholder:font-sans placeholder:tracking-normal placeholder:text-[#AAAAAA] focus:border-black focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!code.trim() || busy || !cartId}
            className="rounded-xl bg-black px-4 py-2.5 font-sans text-[13px] font-medium text-white transition-colors hover:bg-[#1a1a1a] disabled:opacity-40"
          >
            {busy ? "Checking" : "Apply"}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="font-sans text-[12px] text-[#D93025]">
          {error}
        </p>
      )}
      {!error && notice && (
        <p role="status" className="font-sans text-[12px] text-[#7A6200]">
          {notice}
        </p>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { RETURN_WINDOW_DAYS, REVERSE_LOGISTICS_FEE } from "@/config/policy-constants";
import { formatRupees } from "@/lib/money";
import { REQUEST_REASONS, needsUnboxingVideo, type ReturnRequestReason, type ReturnRequestType } from "@/lib/return-requests";

export interface RequestableItem {
  id: string;
  title: string;
  unitPrice: number;
  /** How many of this line can still be put in a new request. */
  available: number;
}

interface Props {
  orderId: string;
  orderNumber: number;
  items: RequestableItem[];
  canReturn: boolean;
  canExchange: boolean;
  /** How long store credit stays valid, as set on the server. */
  walletCreditMonths: number;
}

interface ExchangeOption {
  variantId: string;
  label: string;
  price: number;
}

interface CreatedRequest {
  type: ReturnRequestType;
  status: string;
  amountDue: number | null;
  feeLinkUrl: string | null;
  reverseAwb: string | null;
  exchange: { feeLinkUrl: string | null; amountDue: number | null; priceDifference: number | null } | null;
}

const inputClass =
  "w-full rounded-xl border border-[#E1E1E1] bg-white px-4 py-3 font-sans text-[14px] text-black outline-none transition-colors duration-200 focus:border-black";


export default function ReturnRequestForm({ orderId, orderNumber, items, canReturn, canExchange, walletCreditMonths }: Props) {
  const router = useRouter();
  const [type, setType] = useState<ReturnRequestType>(canReturn ? "return" : "exchange");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [exchangeItem, setExchangeItem] = useState<string>("");
  const [replacement, setReplacement] = useState("");
  const [options, setOptions] = useState<ExchangeOption[] | null>(null);
  const [reason, setReason] = useState<ReturnRequestReason | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedRequest | null>(null);

  // The sizes and designs on offer are only needed for an exchange.
  useEffect(() => {
    if (type !== "exchange" || options) return;
    let cancelled = false;
    fetch("/api/returns/replacements")
      .then((res) => (res.ok ? res.json() : { options: [] }))
      .then((data: { options?: ExchangeOption[] }) => {
        if (!cancelled) setOptions(data.options ?? []);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [type, options]);

  const isExchange = type === "exchange";
  const chosen = isExchange
    ? items.filter((item) => item.id === exchangeItem)
    : items.filter((item) => (quantities[item.id] ?? 0) > 0);
  const qtyOf = (item: RequestableItem) => (isExchange ? 1 : quantities[item.id] ?? 0);
  const chosenTotal = chosen.reduce((sum, item) => sum + item.unitPrice * qtyOf(item), 0);
  const wanted = options?.find((option) => option.variantId === replacement) ?? null;
  const ready = chosen.length > 0 && reason !== "" && (!isExchange || Boolean(wanted)) && !submitting;

  function setQty(item: RequestableItem, value: number) {
    setQuantities((prev) => ({ ...prev, [item.id]: Math.max(0, Math.min(item.available, value)) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          type,
          reason,
          note: note.trim() || undefined,
          replacementVariantId: isExchange ? replacement : undefined,
          items: chosen.map((item) => ({ itemId: item.id, quantity: qtyOf(item) })),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { request: CreatedRequest };
        setCreated(data.request);
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      setError(
        res.status === 401
          ? "Please sign in again to send your request."
          : data.message ?? "We could not send your request. Please try again."
      );
    } catch {
      setError("We could not reach our servers. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const link = created.exchange?.feeLinkUrl ?? created.feeLinkUrl;
    const due = created.exchange?.amountDue ?? created.amountDue;
    return (
      <div className="rounded-2xl border border-[#E1E1E1] px-6 py-10 text-center">
        <h2 className="font-sans font-medium text-[18px] text-black">We have your request</h2>
        {created.status === "pending_fee" && link ? (
          <>
            <p className="mt-2 font-sans text-[14px] text-[#626262]">
              Your replacement costs {due ? formatRupees(due) : "more"} more than the item you are returning. To confirm your exchange, pay that difference using the secure payment link. As soon as it
              is paid, we book the courier to collect your item. We have also sent the link to you by email, SMS and WhatsApp.
            </p>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-block rounded-full bg-black px-7 py-3 font-sans text-[13px] text-white"
            >
              Pay {due ? formatRupees(due) : "now"}
            </a>
          </>
        ) : created.status === "reverse_pickup_scheduled" ? (
          <p className="mt-2 font-sans text-[14px] text-[#626262]">
            Your pickup is booked{created.reverseAwb ? ` (tracking number ${created.reverseAwb})` : ""}. Please pack the item in its
            original box and hand it to the courier agent. When it reaches us and passes the quality check,{" "}
            {created.type === "exchange"
              ? "we send your replacement and message you."
              : "the store credit is added to your wallet and we message you."}
          </p>
        ) : (
          <p className="mt-2 font-sans text-[14px] text-[#626262]">
            Our team will check your request and arrange the pickup. We will email you what happens next.
          </p>
        )}
        <div className="mt-6">
          <Link href={`/orders/${orderId}`} className="inline-block font-sans text-[13px] text-black underline underline-offset-2">
            Back to order #{orderNumber}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-sans text-[12px] font-medium uppercase tracking-wider text-[#626262]">
          What would you like to do?
        </legend>
        <div className="flex gap-3">
          {(["return", "exchange"] as const).map((option) => {
            const allowed = option === "return" ? canReturn : canExchange;
            return (
              <label
                key={option}
                className={`flex-1 rounded-xl border px-4 py-3 text-center font-sans text-[14px] transition-colors duration-200 ${
                  !allowed
                    ? "cursor-not-allowed border-[#F0F0F0] text-[#CFCFCF]"
                    : type === option
                    ? "cursor-pointer border-black bg-black text-white"
                    : "cursor-pointer border-[#E1E1E1] text-black hover:border-black"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={option}
                  checked={type === option}
                  disabled={!allowed}
                  onChange={() => {
                    setType(option);
                    setError(null);
                  }}
                  className="sr-only"
                />
                {option === "return" ? "Return for store credit" : "Exchange size or design"}
              </label>
            );
          })}
        </div>
        <p className="font-sans text-[12px] leading-relaxed text-[#909090]" data-testid="request-terms">
          {isExchange
            ? `There is no fee for an exchange. If your new piece costs more, you pay only the difference by a secure payment link before we book the pickup. If it costs less, the difference is added to your wallet. Open for ${RETURN_WINDOW_DAYS} days after delivery.`
            : `A return is paid back as EYRA store credit, valid for ${walletCreditMonths} months: what you paid for the item, less a flat ${formatRupees(REVERSE_LOGISTICS_FEE)} reverse logistics fee (GST included; no fee at all for a damaged or defective item). There are no cash refunds on delivered items. Open for ${RETURN_WINDOW_DAYS} days after delivery.`}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-sans text-[12px] font-medium uppercase tracking-wider text-[#626262]">
          {isExchange ? "Which item?" : "Which items?"}
        </legend>
        {items.map((item) => {
          const qty = quantities[item.id] ?? 0;
          const unavailable = item.available <= 0;
          const selected = isExchange ? exchangeItem === item.id : qty > 0;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
                unavailable ? "border-[#F0F0F0] opacity-60" : selected ? "border-black" : "border-[#E1E1E1]"
              }`}
            >
              {isExchange ? (
                <input
                  type="radio"
                  name="exchange-item"
                  aria-label={`Exchange ${item.title}`}
                  checked={selected}
                  disabled={unavailable}
                  onChange={() => setExchangeItem(item.id)}
                  className="h-4 w-4 accent-black"
                />
              ) : (
                <input
                  type="checkbox"
                  aria-label={`Include ${item.title}`}
                  checked={qty > 0}
                  disabled={unavailable}
                  onChange={(e) => setQty(item, e.target.checked ? 1 : 0)}
                  className="h-4 w-4 accent-black"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-sans text-[14px] text-black">{item.title}</p>
                <p className="font-sans text-[12px] text-[#909090]">
                  {unavailable ? "Already in a request" : `${formatRupees(item.unitPrice)} each`}
                </p>
              </div>
              {!isExchange && item.available > 1 && qty > 0 && (
                <div className="flex items-center gap-2 font-sans text-[14px]">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQty(item, qty - 1)}
                    className="h-7 w-7 rounded-full border border-[#E1E1E1]"
                  >
                    −
                  </button>
                  <span className="w-5 text-center">{qty}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQty(item, qty + 1)}
                    disabled={qty >= item.available}
                    className="h-7 w-7 rounded-full border border-[#E1E1E1] disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </fieldset>

      {isExchange && (
        <div className="flex flex-col gap-2">
          <label htmlFor="replacement" className="font-sans text-[12px] font-medium uppercase tracking-wider text-[#626262]">
            What would you like instead?
          </label>
          <select id="replacement" value={replacement} onChange={(e) => setReplacement(e.target.value)} className={inputClass}>
            <option value="">{options === null ? "Loading…" : "Choose a size or design"}</option>
            {(options ?? []).map((option) => (
              <option key={option.variantId} value={option.variantId}>
                {option.label} ({formatRupees(option.price)})
              </option>
            ))}
          </select>
          {options !== null && options.length === 0 && (
            <p className="font-sans text-[12px] text-[#B42318]">Nothing is available to exchange for right now. Please try again later.</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="reason" className="font-sans text-[12px] font-medium uppercase tracking-wider text-[#626262]">
          Reason
        </label>
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as ReturnRequestReason | "")}
          className={inputClass}
        >
          <option value="">Choose a reason</option>
          {REQUEST_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {reason !== "" && needsUnboxingVideo(reason) && (
          <p className="font-sans text-[12px] text-[#626262]" data-testid="video-note">
            For damaged or defective items we need your unboxing video. Please keep it, and email it to us if we ask.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="note" className="font-sans text-[12px] font-medium uppercase tracking-wider text-[#626262]">
          Anything we should know? <span className="normal-case text-[#909090]">(optional)</span>
        </label>
        <textarea
          id="note"
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-[#FFF1F1] px-4 py-3 font-sans text-[13px] text-[#B42318]">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="font-sans text-[13px] text-[#626262]">
          {chosen.length > 0 ? `Items value: ${formatRupees(chosenTotal)}` : isExchange ? "Choose the item to exchange" : "Choose at least one item"}
        </p>
        <button
          type="submit"
          disabled={!ready}
          className="rounded-full bg-black px-7 py-3 font-sans text-[13px] text-white transition-opacity duration-200 disabled:opacity-40"
        >
          {submitting ? "Sending…" : isExchange ? "Start exchange" : "Request return"}
        </button>
      </div>
    </form>
  );
}

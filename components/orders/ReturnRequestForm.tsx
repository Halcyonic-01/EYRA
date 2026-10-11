"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatRupees } from "@/lib/money";
import { REQUEST_REASONS, type ReturnRequestReason, type ReturnRequestType } from "@/lib/return-requests";

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
}

const inputClass =
  "w-full rounded-xl border border-[#E1E1E1] bg-white px-4 py-3 font-sans text-[14px] text-black outline-none transition-colors duration-200 focus:border-black";

export default function ReturnRequestForm({ orderId, orderNumber, items, canReturn, canExchange }: Props) {
  const router = useRouter();
  const [type, setType] = useState<ReturnRequestType>(canReturn ? "return" : "exchange");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnRequestReason | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const chosen = items.filter((item) => (quantities[item.id] ?? 0) > 0);
  const chosenTotal = chosen.reduce((sum, item) => sum + item.unitPrice * (quantities[item.id] ?? 0), 0);
  const ready = chosen.length > 0 && reason !== "" && !submitting;

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
          items: chosen.map((item) => ({ itemId: item.id, quantity: quantities[item.id] })),
        }),
      });
      if (res.ok) {
        setDone(true);
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

  if (done) {
    return (
      <div className="rounded-2xl border border-[#E1E1E1] px-6 py-10 text-center">
        <h2 className="font-sans font-medium text-[18px] text-black">We have your request</h2>
        <p className="mt-2 font-sans text-[14px] text-[#626262]">
          Our team will review it and email you. If approved, the value of the items is added to your
          EYRA wallet as store credit.
        </p>
        <Link
          href={`/orders/${orderId}`}
          className="mt-6 inline-block rounded-full bg-black px-6 py-3 font-sans text-[13px] text-white"
        >
          Back to order #{orderNumber}
        </Link>
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
                  onChange={() => setType(option)}
                  className="sr-only"
                />
                {option === "return" ? "Return" : "Exchange"}
              </label>
            );
          })}
        </div>
        <p className="font-sans text-[12px] text-[#909090]">
          Approved requests are paid back as EYRA store credit, which you can use on your next order.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-sans text-[12px] font-medium uppercase tracking-wider text-[#626262]">
          Which items?
        </legend>
        {items.map((item) => {
          const qty = quantities[item.id] ?? 0;
          const unavailable = item.available <= 0;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
                unavailable ? "border-[#F0F0F0] opacity-60" : qty > 0 ? "border-black" : "border-[#E1E1E1]"
              }`}
            >
              <input
                type="checkbox"
                aria-label={`Include ${item.title}`}
                checked={qty > 0}
                disabled={unavailable}
                onChange={(e) => setQty(item, e.target.checked ? 1 : 0)}
                className="h-4 w-4 accent-black"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-sans text-[14px] text-black">{item.title}</p>
                <p className="font-sans text-[12px] text-[#909090]">
                  {unavailable ? "Already in a request" : `${formatRupees(item.unitPrice)} each`}
                </p>
              </div>
              {item.available > 1 && qty > 0 && (
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
          {chosen.length > 0 ? `Items value: ${formatRupees(chosenTotal)}` : "Choose at least one item"}
        </p>
        <button
          type="submit"
          disabled={!ready}
          className="rounded-full bg-black px-7 py-3 font-sans text-[13px] text-white transition-opacity duration-200 disabled:opacity-40"
        >
          {submitting ? "Sending…" : `Send ${type} request`}
        </button>
      </div>
    </form>
  );
}

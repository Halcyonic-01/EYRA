"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { CANCEL_REASONS, type CancelReason, type CancellationPreview, type RefundMethod } from "@/lib/cancellation";
import { formatRupees } from "@/lib/money";

interface Props {
  orderId: string;
  preview: CancellationPreview;
}

interface DoneResult {
  refund_method: "wallet" | "original" | "none";
  refund_amount: number;
  fee: number;
  wallet_used: number;
  refund_status: string;
  wallet_expires_at: string | null;
  eta: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A time as it reads in India, identical on the server and in the browser.
 * Built by hand, because Node and browsers word en-IN dates differently
 * ("8 Oct at 3:00 AM" against "8 Oct, 3:00 am"), which breaks hydration.
 */
function formatIst(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const hour24 = get("hour") % 24;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minute = String(get("minute")).padStart(2, "0");
  return `${get("day")} ${MONTHS[get("month") - 1]}, ${hour12}:${minute} ${hour24 < 12 ? "am" : "pm"}`;
}

function timeLeft(iso: string, now: number): string {
  const minutes = Math.ceil((new Date(iso).getTime() - now) / 60000);
  if (minutes <= 1) return "less than a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

const inputClass =
  "w-full rounded-xl border border-[#E1E1E1] bg-white px-4 py-3 font-sans text-[14px] text-black outline-none transition-colors duration-200 focus:border-black";

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#626262" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

/**
 * The cancel card on an order. While the order can still be cancelled it shows
 * how long is left and opens a confirmation where the customer picks where the
 * refund goes. Once a shipment exists it says so plainly instead.
 */
export default function CancelOrderPanel({ orderId, preview }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reasonId = useId();
  const noteId = useId();

  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [method, setMethod] = useState<RefundMethod>("wallet");
  const [reason, setReason] = useState<CancelReason | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneResult | null>(null);

  const windowEnds = preview.window_ends_at;

  // Keep "time left" honest, and refresh the page when the window closes so
  // the card changes to "being prepared" instead of offering a dead button.
  useEffect(() => {
    if (!windowEnds || !preview.can_cancel) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= new Date(windowEnds).getTime()) router.refresh();
    };
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, [windowEnds, preview.can_cancel, router]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    if (done) router.refresh();
  }, [submitting, done, router]);

  const chosen = preview.requires_choice
    ? method === "wallet"
      ? preview.options.wallet
      : preview.options.original
    : null;
  const refundAmount = chosen?.amount ?? 0;
  const fee = preview.requires_choice && method === "original" ? preview.options.original?.fee ?? 0 : 0;

  async function submit() {
    if (!reason) {
      setError("Please choose a reason for cancelling.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          note: note.trim() || undefined,
          refundMethod: preview.requires_choice ? method : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        cancellation?: { refund_method: DoneResult["refund_method"]; refund_amount: number; fee: number; wallet_used: number; refund_status: string; wallet_expires_at: string | null };
        eta?: string;
        error?: string;
        message?: string;
      };
      if (res.ok && data.cancellation) {
        setDone({ ...data.cancellation, eta: data.eta ?? preview.eta });
        return;
      }
      setError(
        res.status === 401
          ? "Please sign in again to cancel your order."
          : data.message ?? "We could not cancel your order. Please try again."
      );
      // The state of the order changed under us (window closed, shipment created).
      if (res.status === 409) router.refresh();
    } catch {
      setError("We could not reach our servers. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Cannot cancel: say why, plainly ── */
  if (!preview.can_cancel) {
    if (preview.code === "already_cancelled" || preview.code === "not_trackable" || preview.code === "not_your_order") {
      return null;
    }
    return (
      <div className="rounded-2xl border border-[#E1E1E1] px-5 py-4">
        <div className="flex gap-3">
          <InfoIcon />
          <div>
            <p className="font-sans text-[14px] text-black">{preview.message}</p>
            {preview.code === "shipment_created" && (
              <p className="mt-1 font-sans text-[12px] text-[#909090]">
                After it is delivered, you can ask for a return or exchange from this page.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const wallet = preview.options.wallet;
  const original = preview.options.original;

  return (
    <>
      <div className="rounded-2xl border border-[#E1E1E1] overflow-hidden">
        <div className="bg-[#F7F7F7] px-5 py-3">
          <p className="font-sans font-medium text-[12px] text-[#626262] uppercase tracking-wider">Cancel this order</p>
        </div>
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-sans text-[14px] text-black">
              You can cancel until <strong className="font-semibold">{windowEnds ? formatIst(windowEnds) : ""}</strong>
              {windowEnds && now !== null && <span className="text-[#626262]"> ({timeLeft(windowEnds, now)} left)</span>}.
            </p>
            <p className="mt-1 font-sans text-[12px] text-[#909090]">
              After that we start preparing your order for shipping, and it can no longer be cancelled.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex-shrink-0 rounded-full border border-black px-6 py-2.5 font-sans text-[13px] text-black transition-colors duration-200 hover:bg-black hover:text-white"
          >
            Cancel order
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${reasonId}-title`}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-full max-w-[520px] overflow-hidden rounded-2xl bg-white p-0 text-black shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop:bg-black/55 max-sm:mb-0 max-sm:max-h-[94dvh] max-sm:max-w-full max-sm:rounded-b-none"
      >
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
            <h2 id={`${reasonId}-title`} className="font-sans text-[18px] font-medium">
              {done ? "Order cancelled" : `Cancel order #${preview.display_id}`}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F2F2F2] text-[#444] transition-colors duration-200 hover:bg-[#E6E6E6]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {done ? (
            <div className="overflow-y-auto px-6 pb-6 pt-2">
              <p className="font-sans text-[14px] leading-relaxed text-[#444]">
                {done.refund_status === "failed"
                  ? "Your order is cancelled. We are finishing your refund and will email you as soon as it is done."
                  : done.refund_method === "wallet"
                  ? `${formatRupees(done.refund_amount)} has been added to your EYRA wallet${done.wallet_expires_at ? `, valid until ${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }).format(new Date(done.wallet_expires_at))}` : ""}.`
                  : done.refund_method === "original"
                  ? `Your refund of ${formatRupees(done.refund_amount)} has started and will reach your original payment method in ${done.eta}.`
                  : "Your order is cancelled. No payment was taken, so there is nothing to refund."}
                {done.wallet_used > 0 && ` The ${formatRupees(done.wallet_used)} of wallet credit you used goes back to your wallet.`}
              </p>
              <p className="mt-3 font-sans text-[12px] text-[#909090]">We have also sent you an email.</p>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={close} className="rounded-full bg-black px-7 py-3 font-sans text-[13px] text-white">
                  Done
                </button>
                {(done.refund_method === "wallet" || done.wallet_used > 0) && (
                  <Link href="/wallet" className="rounded-full border border-[#E1E1E1] px-7 py-3 font-sans text-[13px] text-black">
                    View wallet
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-5 overflow-y-auto px-6 pb-4 pt-2">
                <p className="font-sans text-[13px] leading-relaxed text-[#626262]">
                  Cancelling stops your order before we start preparing it. This cannot be undone.
                </p>

                {preview.requires_choice && wallet && original && (
                  <fieldset className="flex flex-col gap-3">
                    <legend className="mb-2 font-sans text-[12px] font-medium uppercase tracking-wider text-[#626262]">
                      Where should your refund go?
                    </legend>

                    <label
                      className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors duration-200 ${
                        method === "wallet" ? "border-black bg-[#FAFAFA]" : "border-[#E1E1E1] hover:border-[#AAAAAA]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="refund"
                        value="wallet"
                        checked={method === "wallet"}
                        onChange={() => setMethod("wallet")}
                        className="mt-1 h-4 w-4 accent-black"
                      />
                      <span className="flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-sans text-[15px] font-bold text-black">Refund to your EYRA wallet</span>
                          <span className="font-sans text-[15px] font-bold text-black">{formatRupees(wallet.amount)}</span>
                        </span>
                        <span className="mt-1 block font-sans text-[12px] font-bold text-black">100% refund, added instantly</span>
                        <span className="mt-0.5 block font-sans text-[12px] text-[#626262]">
                          Use it on your next order. Valid for {preview.wallet_valid_months} months.
                        </span>
                      </span>
                    </label>

                    <label
                      className={`flex gap-3 rounded-2xl border p-4 transition-colors duration-200 ${
                        !original.available
                          ? "cursor-not-allowed border-[#EEEEEE] opacity-60"
                          : method === "original"
                          ? "cursor-pointer border-black bg-[#FAFAFA]"
                          : "cursor-pointer border-[#E1E1E1] hover:border-[#AAAAAA]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="refund"
                        value="original"
                        checked={method === "original"}
                        disabled={!original.available}
                        onChange={() => setMethod("original")}
                        className="mt-1 h-4 w-4 accent-black"
                      />
                      <span className="flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-sans text-[15px] font-normal text-black">Refund to your original payment method</span>
                          <span className="font-sans text-[15px] font-normal text-black">{formatRupees(original.amount)}</span>
                        </span>
                        <span className="mt-1 block font-sans text-[12px] text-[#626262]">
                          {original.available
                            ? `A ${formatRupees(original.fee)} cancellation fee is kept. Takes ${preview.eta} to reach your account or card.`
                            : original.unavailable_reason}
                        </span>
                      </span>
                    </label>
                  </fieldset>
                )}

                <div className="flex flex-col gap-2">
                  <label htmlFor={reasonId} className="font-sans text-[12px] font-medium uppercase tracking-wider text-[#626262]">
                    Why are you cancelling?
                  </label>
                  <select id={reasonId} value={reason} onChange={(e) => setReason(e.target.value as CancelReason | "")} className={inputClass}>
                    <option value="">Choose a reason</option>
                    {CANCEL_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor={noteId} className="font-sans text-[12px] font-medium uppercase tracking-wider text-[#626262]">
                    Anything else? <span className="normal-case text-[#909090]">(optional)</span>
                  </label>
                  <textarea id={noteId} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
                </div>

                <div className="rounded-2xl bg-[#F7F7F7] px-4 py-3 font-sans text-[13px]">
                  {preview.requires_choice ? (
                    <>
                      <div className="flex justify-between py-1 text-[#626262]">
                        <span>You paid online</span>
                        <span>{formatRupees(preview.paid_online)}</span>
                      </div>
                      {fee > 0 && (
                        <div className="flex justify-between py-1 text-[#626262]">
                          <span>Cancellation fee</span>
                          <span>- {formatRupees(fee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-[#E6E6E6] pt-2 text-[14px] font-semibold text-black">
                        <span>{method === "wallet" ? "Added to your wallet" : "Refund to original payment method"}</span>
                        <span>{formatRupees(refundAmount)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-[#444]">No payment was taken for this order, so there is nothing to refund.</p>
                  )}
                  {preview.wallet_used > 0 && (
                    <p className="mt-2 text-[12px] text-[#626262]">
                      The {formatRupees(preview.wallet_used)} of wallet credit you used goes back to your wallet in full.
                    </p>
                  )}
                </div>

                {error && (
                  <p role="alert" className="rounded-xl bg-[#FFF1F1] px-4 py-3 font-sans text-[13px] text-[#B42318]">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-[#F0F0F0] px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={close}
                  disabled={submitting}
                  className="rounded-full border border-[#E1E1E1] px-7 py-3 font-sans text-[13px] text-black transition-colors duration-200 hover:border-black disabled:opacity-50"
                >
                  Keep my order
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-full bg-black px-7 py-3 font-sans text-[13px] text-white transition-opacity duration-200 disabled:opacity-60"
                >
                  {submitting
                    ? "Cancelling…"
                    : preview.requires_choice
                    ? `Cancel order and refund ${formatRupees(refundAmount)}`
                    : "Cancel order"}
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { CANCEL_REASONS, type CancelReason, type CancellationPreview } from "@/lib/cancellation";
import { EXCHANGE_WINDOW_DAYS, RETURN_WINDOW_DAYS } from "@/config/policy-constants";
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

  // An order cancelled before it ships is refunded in full to the payment method it was paid with.
  const original = preview.options.original;
  const refundsOnline = preview.paid_online > 0 && Boolean(original);
  const refundAmount = refundsOnline ? original?.amount ?? 0 : 0;

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
                Once it is delivered, returns are open for {RETURN_WINDOW_DAYS} days and exchanges for {EXCHANGE_WINDOW_DAYS} days, from this page.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

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

                {refundsOnline && (
                  <div className="rounded-2xl border border-[#E1E1E1] bg-[#FAFAFA] p-4">
                    <p className="font-sans text-[14px] font-medium text-black">100% refund, nothing deducted</p>
                    <p className="mt-1 font-sans text-[12px] text-[#626262]">
                      Your {formatRupees(refundAmount)} goes back to the payment method you paid with. It takes{" "}
                      {preview.eta} to reach your account or card.
                    </p>
                  </div>
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
                  {refundsOnline ? (
                    <>
                      <div className="flex justify-between py-1 text-[#626262]">
                        <span>You paid online</span>
                        <span>{formatRupees(preview.paid_online)}</span>
                      </div>
                      <div className="flex justify-between border-t border-[#E6E6E6] pt-2 text-[14px] font-semibold text-black">
                        <span>Refund to your original payment method</span>
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
                    : refundsOnline
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

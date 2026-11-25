"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useCartStore } from "@/store/useStore";
import {
  PAYU_POLL_ATTEMPTS,
  PAYU_POLL_INTERVAL_MS,
  payuView,
  type PayuStatusAnswer,
  type PayuView,
} from "@/lib/payu";

async function askStatus(): Promise<PayuStatusAnswer> {
  try {
    const res = await fetch("/api/payu/status", { method: "POST", cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as PayuStatusAnswer;
  } catch {
    return { status: "unavailable", orderId: null, cartId: null, paymentId: null, cancelled: false };
  }
}

/** Where a PayU payment stands, always as the backend reports it. Success only once there is an order. */
export function PayuStatus() {
  const router = useRouter();
  const clearCart = useCartStore((s) => s.clearCart);
  const [view, setView] = useState<PayuView | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  // Bumped by "Check again" to start a fresh round of checks.
  const [round, setRound] = useState(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const wait = () => new Promise<void>((done) => { timer = setTimeout(done, PAYU_POLL_INTERVAL_MS); });

    (async () => {
      for (let attempt = 1; ; attempt++) {
        const answer = await askStatus();
        if (stopped) return;
        setPaymentId(answer.paymentId);
        const next = payuView(answer);

        if (next.kind === "confirmed" && answer.orderId) {
          // Only the cart this payment was for; a newer cart in this browser stays.
          const current = useCartStore.getState().cartId;
          if (!current || current === answer.cartId) clearCart();
          const params = new URLSearchParams({ orderId: answer.orderId, method: "prepaid", provider: "payu" });
          if (answer.paymentId) params.set("payment_id", answer.paymentId);
          router.replace(`/orders/success?${params.toString()}`);
          return;
        }

        setView(next);
        if (next.kind !== "waiting") return;
        if (attempt >= PAYU_POLL_ATTEMPTS) {
          setGaveUp(true);
          return;
        }
        await wait();
        if (stopped) return;
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [round, clearCart, router]);

  function checkAgain() {
    setGaveUp(false);
    setRound((r) => r + 1);
  }

  if (!view) {
    return (
      <StatusShell testId="payu-status-loading" title="Checking your payment" tone="neutral">
        <p className="font-sans text-[15px] text-[#626262]">One moment while we confirm your payment with PayU.</p>
        <Spinner />
      </StatusShell>
    );
  }

  if (view.kind === "confirmed") {
    return (
      <StatusShell testId="payu-status-confirmed" title="Payment confirmed" tone="good">
        <p className="font-sans text-[15px] text-[#626262]">Taking you to your order.</p>
      </StatusShell>
    );
  }

  const tone = view.kind === "waiting" || view.kind === "refunded" ? "neutral" : "bad";
  return (
    <StatusShell testId={`payu-status-${view.kind}`} title={view.title} tone={tone}>
      <p className="font-sans text-[15px] leading-[23px] text-[#626262]" data-testid="payu-status-message">
        {gaveUp
          ? "This is taking longer than usual. You don't need to wait here: once PayU confirms the payment your order is placed and we email you. If it isn't confirmed, the money is refunded automatically. Please don't pay again."
          : view.message}
      </p>

      {view.kind === "waiting" && !gaveUp && <Spinner />}

      {paymentId && (
        <p className="font-sans text-[13px] text-[#909090]">
          PayU payment ID: <span className="text-[#626262] break-all" data-testid="payu-payment-id">{paymentId}</span>
        </p>
      )}

      <div className="flex gap-3 flex-wrap justify-center">
        {(view.kind === "failed" || view.kind === "cancelled") && (
          <Link href="/checkout" className={PRIMARY} data-testid="payu-try-again">
            Try again
          </Link>
        )}
        {view.kind === "waiting" && gaveUp && (
          <button type="button" onClick={checkAgain} className={PRIMARY} data-testid="payu-check-again">
            Check again
          </button>
        )}
        {(view.kind === "refunded" || view.kind === "unverified" || gaveUp) && (
          <Link href="/orders" className={PRIMARY}>
            View my orders
          </Link>
        )}
        <Link href="/contact" className={SECONDARY}>
          Contact support
        </Link>
      </div>

      {(view.kind === "failed" || view.kind === "cancelled") && (
        <p className="font-sans text-[13px] text-[#909090] max-w-[420px]">
          You can pay with PayU again, or choose Razorpay or Cash on Delivery at checkout.
        </p>
      )}
    </StatusShell>
  );
}

const PRIMARY =
  "px-8 py-[14px] bg-black text-white font-sans font-medium text-[16px] rounded-full hover:bg-[#1a1a1a] transition-colors duration-200";
const SECONDARY =
  "px-8 py-[14px] border border-[#CFCFCF] text-black font-sans font-medium text-[16px] rounded-full hover:bg-[#F7F7F7] transition-colors duration-200";

function StatusShell({
  testId, title, tone, children,
}: { testId: string; title: string; tone: "good" | "bad" | "neutral"; children: React.ReactNode }) {
  const ring = tone === "good" ? "bg-black" : tone === "bad" ? "bg-[#D93025]" : "bg-[#F0F0F0]";
  return (
    <div
      className="max-w-screen-xl mx-auto px-6 py-16 sm:py-20 flex flex-col items-center gap-6 text-center"
      data-testid={testId}
      aria-live="polite"
    >
      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${ring}`} aria-hidden="true">
        {tone === "good" ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : tone === "bad" ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#626262" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        )}
      </div>
      <h1 className="font-sans font-medium text-[26px] sm:text-[30px] text-black">{title}</h1>
      <div className="w-full max-w-[480px] flex flex-col items-center gap-5">{children}</div>
    </div>
  );
}

function Spinner() {
  return <div className="w-6 h-6 border-2 border-[#E1E1E1] border-t-black rounded-full animate-spin" role="status" aria-label="Checking" />;
}

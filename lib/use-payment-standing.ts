"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { STANDING_POLL_MS, standingView, type PaymentStanding } from "@/lib/payment-standing";

/** Stands in when the backend cannot answer: paying pauses rather than guessing. */
function unknownStanding(cartId: string): PaymentStanding {
  return {
    cart_id: cartId, state: "unknown", order_id: null, provider_id: null, provider_name: null,
    pending_since: null, retry_after: null, can_pay: false, allowed_providers: [], refunds: [],
  };
}

export async function fetchStanding(cartId: string): Promise<PaymentStanding | null> {
  try {
    const res = await fetch("/api/checkout/payment-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId }),
      cache: "no-store",
    });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) return unknownStanding(cartId);
    return ((await res.json()) as { payment: PaymentStanding }).payment;
  } catch {
    return unknownStanding(cartId);
  }
}

/**
 * The cart's payment standing while `active`: asked once, again on refresh(),
 * when the tab regains focus (the customer may have just approved a UPI
 * request on their phone), and every few seconds while it is unsettled.
 */
export function usePaymentStanding(cartId: string | null, active: boolean) {
  const [standing, setStanding] = useState<PaymentStanding | null>(null);
  const [checking, setChecking] = useState(false);
  const latest = useRef(0);

  const refresh = useCallback(async (): Promise<PaymentStanding | null> => {
    if (!cartId) return null;
    const ticket = ++latest.current;
    setChecking(true);
    const next = await fetchStanding(cartId);
    // An older answer arriving late must not overwrite a newer one.
    if (ticket === latest.current) {
      setStanding(next);
      setChecking(false);
    }
    return next;
  }, [cartId]);

  useEffect(() => {
    if (!active || !cartId) return;
    const first = setTimeout(() => void refresh(), 0);
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [active, cartId, refresh]);

  const polling = active && Boolean(standingView(standing)?.poll);
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => void refresh(), STANDING_POLL_MS);
    return () => clearInterval(timer);
  }, [polling, refresh]);

  return { standing, checking, refresh };
}

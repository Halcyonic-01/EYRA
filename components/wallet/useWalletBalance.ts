"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

export interface WalletSummary {
  balance: number;
  nextExpiry: { amount: number; expiresAt: string } | null;
}

/**
 * The signed-in customer's spendable balance, for the header. One copy is
 * shared by everything that shows it, and it is refreshed at most once a
 * minute, except on pages that change the balance (the order success page and
 * the wallet itself), which always refresh it.
 */

const REFRESH_AFTER_MS = 60_000;

let current: WalletSummary | null = null;
let fetchedAt = 0;
let inFlight = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

async function refresh() {
  if (inFlight) return;
  inFlight = true;
  try {
    const res = await fetch("/api/wallet?summary=1");
    if (!res.ok) return;
    const data = (await res.json()) as {
      signedIn?: boolean;
      balance?: number;
      nextExpiry?: WalletSummary["nextExpiry"];
    };
    current =
      data.signedIn && typeof data.balance === "number"
        ? { balance: data.balance, nextExpiry: data.nextExpiry ?? null }
        : null;
    fetchedAt = Date.now();
    notify();
  } catch {
    // The header simply shows no balance; nothing else depends on it.
  } finally {
    inFlight = false;
  }
}

export function useWalletBalance(signedIn: boolean): WalletSummary | null {
  const pathname = usePathname();
  const summary = useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );

  useEffect(() => {
    if (!signedIn) {
      // Never show one customer's balance to the next person who signs in.
      current = null;
      fetchedAt = 0;
      return;
    }
    const alwaysFresh = pathname.startsWith("/orders/success") || pathname.startsWith("/wallet");
    if (alwaysFresh || Date.now() - fetchedAt > REFRESH_AFTER_MS) {
      void refresh();
    }
  }, [signedIn, pathname]);

  return signedIn ? summary : null;
}

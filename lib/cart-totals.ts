"use client";

import { useMemo } from "react";
import { useCartStore } from "@/store/useStore";

export interface CartTotalsView {
  /** Items at the prices Medusa charges, before any code. */
  subtotal: number;
  discount: number;
  delivery: number;
  tax: number;
  /** What a prepaid order costs: items less any code. Cash on Delivery adds its charge at checkout. */
  total: number;
  /** True until the Medusa cart has synced; the numbers are then worked out from the items. */
  isEstimate: boolean;
  /** Units, not lines. */
  quantity: number;
  /** The amount saved against the original prices, plus any code. */
  saved: number;
}

/**
 * The bag's totals as the full bag page and the slide-out bag both show them.
 * Server totals win; a client estimate stands in only until the cart syncs.
 */
export function useCartTotals(): CartTotalsView {
  const items = useCartStore((s) => s.items);
  const serverTotals = useCartStore((s) => s.serverTotals);

  return useMemo(() => {
    const quantity = items.reduce((n, i) => n + i.quantity, 0);
    const offOriginal = items.reduce(
      (sum, i) => sum + Math.max(0, i.originalUnitPrice - i.unitPrice) * i.quantity,
      0
    );
    if (serverTotals) {
      return {
        subtotal: serverTotals.subtotal,
        discount: serverTotals.discountTotal,
        delivery: serverTotals.shippingTotal,
        tax: serverTotals.taxTotal,
        total: serverTotals.subtotal - serverTotals.discountTotal,
        isEstimate: false,
        quantity,
        saved: offOriginal + serverTotals.discountTotal,
      };
    }
    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    return { subtotal, discount: 0, delivery: 0, tax: 0, total: subtotal, isEstimate: true, quantity, saved: offOriginal };
  }, [serverTotals, items]);
}

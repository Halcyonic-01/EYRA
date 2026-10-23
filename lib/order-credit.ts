/**
 * Splits the credit lines on an order into wallet credit and everything else.
 *
 * Medusa takes credit lines off an order's `total`, and it adds some of its own:
 * for example when staff cancel an order in the admin it records the amount to
 * be returned as a credit line with the reference "payment_collection". Only the
 * lines the wallet made (reference "wallet") are wallet credit a customer used,
 * so only those are shown as such.
 */

export interface CreditLineLike {
  amount?: number | string | null;
  reference?: string | null;
}

export interface OrderCreditInput {
  total: number;
  /** All credit lines together, whoever made them. */
  credit_line_total?: number | null;
  /** The lines themselves, when they were asked for. */
  credit_lines?: CreditLineLike[] | null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Wallet credit the customer used on this order. */
export function walletCreditOf(order: Pick<OrderCreditInput, "credit_line_total" | "credit_lines">): number {
  const lines = order.credit_lines;
  // Without the lines there is no telling the kinds apart, so every credit line counts, as it always did.
  if (!Array.isArray(lines)) return round2(Number(order.credit_line_total ?? 0) || 0);
  return round2(
    lines
      .filter((line) => line?.reference === "wallet")
      .reduce((sum, line) => sum + (Number(line.amount) || 0), 0)
  );
}

/**
 * What the order cost after wallet credit and nothing else. Medusa's own
 * `total` is also lowered by credit lines it made itself, so those are put back.
 */
export function totalAfterWallet(order: OrderCreditInput): number {
  const all = Number(order.credit_line_total ?? 0) || 0;
  return round2(order.total + (all - walletCreditOf(order)));
}

/**
 * Payment-level idempotency for the Razorpay webhook, as plain logic over a
 * small key-value store so it can be tested without Redis.
 *
 * A claim is temporary while the payment is being processed and permanent only
 * once the order is completed and confirmed. If the process dies part-way (a
 * function timeout, a crash), the temporary claim simply expires and Razorpay's
 * next redelivery processes the payment. A delivery that arrives while another
 * is still processing is told to come back later rather than being acknowledged.
 */

export interface ClaimStore {
  /** SET key value [NX] EX seconds. Resolves "OK" when written, null when NX found the key. */
  set(key: string, value: string, options: { nx?: boolean; ex: number }): Promise<"OK" | null | string>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
}

/** Longer than the webhook route may run (maxDuration), so a live claim never expires mid-flight. */
export const PROCESSING_TTL_SECONDS = 5 * 60;

/** Keep processed payment IDs well past Razorpay's retry window. */
export const DONE_TTL_SECONDS = 60 * 60 * 24 * 30;

export type PaymentClaim =
  /** This delivery now owns the payment and should proceed. */
  | "claimed"
  /** Another delivery is processing it right now; ask Razorpay to retry later. */
  | "in_progress"
  /** Already completed and confirmed; acknowledge and do nothing. */
  | "already_processed"
  /** The store is unreachable; the caller must rely on the backend's own idempotency. */
  | "unavailable";

export const paymentKey = (paymentId: string) => `eyra:rzp:payment:${paymentId}`;

export async function claimPaymentIn(store: ClaimStore | null, paymentId: string): Promise<PaymentClaim> {
  if (!store) return "unavailable";
  const key = paymentKey(paymentId);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await store.set(key, `processing:${new Date().toISOString()}`, {
        nx: true,
        ex: PROCESSING_TTL_SECONDS,
      });
      if (result === "OK") return "claimed";
      const existing = await store.get(key);
      if (existing === null) continue; // expired between the two calls: try once more
      return existing.startsWith("done") ? "already_processed" : "in_progress";
    }
    return "in_progress";
  } catch (err) {
    console.error("[payment-claim] claim failed for", paymentId, ":", err);
    return "unavailable";
  }
}

/** Makes the claim permanent once the order exists and is confirmed. */
export async function markProcessedIn(store: ClaimStore | null, paymentId: string): Promise<void> {
  if (!store) return;
  try {
    await store.set(paymentKey(paymentId), `done:${new Date().toISOString()}`, { ex: DONE_TTL_SECONDS });
  } catch (err) {
    // The temporary claim expires, and a redelivery finds the order already done.
    console.error("[payment-claim] could not mark", paymentId, "processed:", err);
  }
}

/** Drops a temporary claim so a retry can try again straight away. */
export async function releaseIn(store: ClaimStore | null, paymentId: string): Promise<void> {
  if (!store) return;
  try {
    const existing = await store.get(paymentKey(paymentId));
    if (existing && existing.startsWith("done")) return;
    await store.del(paymentKey(paymentId));
  } catch (err) {
    // Not fatal: the temporary claim expires on its own within PROCESSING_TTL_SECONDS.
    console.error("[payment-claim] could not release", paymentId, ":", err);
  }
}

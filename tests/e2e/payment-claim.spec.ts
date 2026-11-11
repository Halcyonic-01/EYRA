import { test, expect } from "@playwright/test";
import {
  DONE_TTL_SECONDS,
  PROCESSING_TTL_SECONDS,
  claimPaymentIn,
  markProcessedIn,
  paymentKey,
  releaseIn,
  type ClaimStore,
} from "../../lib/payment-claim";

// The Razorpay webhook's payment claim, against a fake Redis with a clock, so
// expiry (a crashed delivery) and outages can be played out exactly.

function fakeRedis() {
  let now = 0;
  let down = false;
  const data = new Map<string, { value: string; expiresAt: number }>();
  const live = (key: string) => {
    const row = data.get(key);
    if (row && row.expiresAt <= now) data.delete(key);
    return data.get(key) ?? null;
  };
  const guard = () => {
    if (down) throw new Error("ECONNREFUSED");
  };
  const store: ClaimStore = {
    async set(key, value, { nx, ex }) {
      guard();
      if (nx && live(key)) return null;
      data.set(key, { value, expiresAt: now + ex * 1000 });
      return "OK";
    },
    async get(key) {
      guard();
      return live(key)?.value ?? null;
    },
    async del(key) {
      guard();
      data.delete(key);
      return 1;
    },
  };
  return {
    store,
    advance: (seconds: number) => (now += seconds * 1000),
    disconnect: () => (down = true),
    reconnect: () => (down = false),
    ttlLeft: (key: string) => {
      const row = live(key);
      return row ? (row.expiresAt - now) / 1000 : 0;
    },
  };
}

test.describe("Razorpay webhook payment claim", () => {
  test("the first delivery claims; a simultaneous duplicate is told to come back later", async () => {
    const redis = fakeRedis();
    const [a, b] = await Promise.all([claimPaymentIn(redis.store, "pay_1"), claimPaymentIn(redis.store, "pay_1")]);
    expect([a, b].sort()).toEqual(["claimed", "in_progress"]);
  });

  test("a claim is temporary until the order is confirmed, then permanent", async () => {
    const redis = fakeRedis();
    expect(await claimPaymentIn(redis.store, "pay_1")).toBe("claimed");
    expect(redis.ttlLeft(paymentKey("pay_1"))).toBe(PROCESSING_TTL_SECONDS);

    await markProcessedIn(redis.store, "pay_1");
    expect(redis.ttlLeft(paymentKey("pay_1"))).toBe(DONE_TTL_SECONDS);
    expect(await claimPaymentIn(redis.store, "pay_1")).toBe("already_processed");
  });

  test("a delivery that crashes after claiming does not block the redelivery for long", async () => {
    const redis = fakeRedis();
    expect(await claimPaymentIn(redis.store, "pay_1")).toBe("claimed");
    // The function is killed here: no release, no mark.
    expect(await claimPaymentIn(redis.store, "pay_1")).toBe("in_progress");
    redis.advance(PROCESSING_TTL_SECONDS + 1);
    expect(await claimPaymentIn(redis.store, "pay_1")).toBe("claimed");
  });

  test("a failed delivery releases its claim so the retry can run at once", async () => {
    const redis = fakeRedis();
    await claimPaymentIn(redis.store, "pay_1");
    await releaseIn(redis.store, "pay_1");
    expect(await claimPaymentIn(redis.store, "pay_1")).toBe("claimed");
  });

  test("releasing never undoes a payment already marked processed", async () => {
    const redis = fakeRedis();
    await claimPaymentIn(redis.store, "pay_1");
    await markProcessedIn(redis.store, "pay_1");
    await releaseIn(redis.store, "pay_1");
    expect(await claimPaymentIn(redis.store, "pay_1")).toBe("already_processed");
  });

  test("Redis down: the claim reports unavailable, and works again once Redis is back", async () => {
    const redis = fakeRedis();
    redis.disconnect();
    expect(await claimPaymentIn(redis.store, "pay_1")).toBe("unavailable");
    // Marking and releasing must not throw while Redis is down.
    await markProcessedIn(redis.store, "pay_1");
    await releaseIn(redis.store, "pay_1");

    redis.reconnect();
    expect(await claimPaymentIn(redis.store, "pay_1")).toBe("claimed");
  });

  test("Redis drops after the claim: the temporary claim still expires and the retry proceeds", async () => {
    const redis = fakeRedis();
    expect(await claimPaymentIn(redis.store, "pay_1")).toBe("claimed");
    redis.disconnect();
    await markProcessedIn(redis.store, "pay_1"); // lost
    redis.reconnect();
    redis.advance(PROCESSING_TTL_SECONDS + 1);
    expect(await claimPaymentIn(redis.store, "pay_1")).toBe("claimed");
  });

  test("no Redis configured at all", async () => {
    expect(await claimPaymentIn(null, "pay_1")).toBe("unavailable");
  });

  test("the claim outlives the webhook route's maximum run time", async () => {
    const { readFileSync } = await import("node:fs");
    const route = readFileSync("app/api/razorpay/webhook/route.ts", "utf8");
    const maxDuration = Number(/export const maxDuration = (\d+)/.exec(route)?.[1]);
    expect(maxDuration).toBeGreaterThan(0);
    expect(PROCESSING_TTL_SECONDS).toBeGreaterThan(maxDuration);
  });
});

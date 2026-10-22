import { test, expect } from "@playwright/test";
import { jwtExpiry } from "../../lib/jwt-expiry";
import { shiprocketStatus, TOKEN_WARNING_DAYS } from "../../lib/shiprocket-status";

// A launch blocker is a Shiprocket token that quietly runs out, so the status
// check names what is wrong before a shipment fails.

const now = new Date("2026-10-17T00:00:00Z");
const day = 24 * 60 * 60 * 1000;

function token(expiresAt: Date): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256" })}.${part({ exp: Math.floor(expiresAt.getTime() / 1000) })}.signature`;
}

const complete = { SHIPROCKET_WEBHOOK_SECRET: "set", SHIPROCKET_PICKUP_LOCATION: "Warehouse" };

test.describe("Shiprocket status", () => {
  test("reads when a token runs out, without verifying it", () => {
    const when = new Date("2026-10-27T00:00:00Z");
    expect(jwtExpiry(token(when))?.toISOString()).toBe(when.toISOString());
    expect(jwtExpiry("not-a-jwt")).toBeNull();
    expect(jwtExpiry(undefined)).toBeNull();
  });

  test("a token that renews itself needs no warning about expiry", () => {
    const status = shiprocketStatus({ ...complete, SHIPROCKET_EMAIL: "a@b.c", SHIPROCKET_PASSWORD: "x" }, now);
    expect(status.autoRenew).toBe(true);
    expect(status.problems).toEqual([]);
  });

  test("a healthy fixed token has no problems", () => {
    const status = shiprocketStatus({ ...complete, SHIPROCKET_API_TOKEN: token(new Date(now.getTime() + 8 * day)) }, now);
    expect(status.problems).toEqual([]);
    expect(status.tokenExpiresAt).toBe("2026-10-25T00:00:00.000Z");
  });

  test("warns before a fixed token runs out, and once it has", () => {
    const soon = shiprocketStatus({ ...complete, SHIPROCKET_API_TOKEN: token(new Date(now.getTime() + (TOKEN_WARNING_DAYS - 1) * day)) }, now);
    expect(soon.problems[0]).toMatch(/expires on 2026-10-19/);
    const gone = shiprocketStatus({ ...complete, SHIPROCKET_API_TOKEN: token(new Date(now.getTime() - day)) }, now);
    expect(gone.problems[0]).toMatch(/expired on 2026-10-16/);
  });

  test("says when nothing is set up, or the token is not a Shiprocket token", () => {
    expect(shiprocketStatus(complete, now).problems[0]).toMatch(/not set up/);
    expect(shiprocketStatus({ ...complete, SHIPROCKET_API_TOKEN: "ujIlluS-not-a-token" }, now).problems[0]).toMatch(/not a Shiprocket token/);
  });

  test("names a missing webhook secret and pickup location", () => {
    const status = shiprocketStatus({ SHIPROCKET_EMAIL: "a@b.c", SHIPROCKET_PASSWORD: "x" }, now);
    expect(status.problems.some((p) => p.includes("SHIPROCKET_WEBHOOK_SECRET"))).toBe(true);
    expect(status.problems.some((p) => p.includes("SHIPROCKET_PICKUP_LOCATION"))).toBe(true);
  });

  test("never puts a secret in a message", () => {
    const secret = "very-secret-password";
    const status = shiprocketStatus({ SHIPROCKET_EMAIL: "owner@example.com", SHIPROCKET_PASSWORD: secret, SHIPROCKET_API_TOKEN: "abc.def" }, now);
    expect(JSON.stringify(status)).not.toContain(secret);
    expect(JSON.stringify(status)).not.toContain("owner@example.com");
  });

  test("the status route is for the backend only", async ({ request }) => {
    const res = await request.post("/api/ops/shiprocket-status", { data: {} });
    expect([401, 503]).toContain(res.status());
  });
});

import { test, expect } from "@playwright/test";
import { LOGIN_RETRY_MS, loginAllowed, loginFailureHint } from "../../lib/shiprocket-backoff";

// A refused Shiprocket sign-in is not retried on every page view. Pure logic.

test.describe("Shiprocket sign-in after a refusal", () => {
  test("is tried when nothing has failed", () => {
    expect(loginAllowed(null, 1_000_000)).toBe(true);
  });

  test("is not tried again until the wait is over", () => {
    const failedAt = 1_000_000;
    expect(loginAllowed(failedAt, failedAt + 1)).toBe(false);
    expect(loginAllowed(failedAt, failedAt + LOGIN_RETRY_MS - 1)).toBe(false);
    expect(loginAllowed(failedAt, failedAt + LOGIN_RETRY_MS)).toBe(true);
  });

  test("tells the developer what to check for a refusal, without printing any secret", () => {
    for (const status of [401, 403]) {
      expect(loginFailureHint(status)).toContain("SHIPROCKET_EMAIL");
      expect(loginFailureHint(status)).toContain("API user");
    }
    expect(loginFailureHint(500)).not.toContain("API user");
  });
});

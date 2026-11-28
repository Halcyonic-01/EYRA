import { test, expect } from "@playwright/test";

import { CONSENT_COOKIE } from "../../lib/analytics/consent";
import { catchAnalytics, named, posthogTraces, setConsentCookie, watchAnalyticsRequests } from "./helpers/analytics-capture";

/**
 * Explicit consent before analytics: PostHog's code, cookies, requests and
 * events exist only after the customer accepts, and go away when they withdraw.
 *
 * The browser part needs a build with a PostHog key (and a Sentry DSN, for the
 * check that Sentry is independent of the choice):
 *   NEXT_PUBLIC_POSTHOG_KEY=phc_e2etestkeyonly000 NEXT_PUBLIC_SENTRY_DSN=http://e2ekey@localhost:9876/9 npm run build && npm start
 * then E2E_ANALYTICS=1. The consent API checks run in the normal suite.
 */

const PRODUCT = "/products/luna-anklet";
const banner = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "Your privacy at EYRA" });

test.describe("the consent API", () => {
  test("refuses anything but a well-formed choice", async ({ request }) => {
    for (const data of [{}, { status: "yes", at: new Date().toISOString(), version: 1 }, { status: "granted", at: "soon", version: 1 }, { status: "granted", at: new Date().toISOString(), version: 9 }]) {
      expect((await request.post("/api/analytics/consent", { data })).status()).toBe(400);
    }
  });

  test("stores nothing for a visitor who is not signed in (the browser sends it again after sign-in)", async ({ request }) => {
    const res = await request.post("/api/analytics/consent", { data: { status: "granted", at: new Date().toISOString(), version: 1 } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ stored: false });
  });
});

test.describe("analytics consent in the browser", () => {
  test.skip(process.env.E2E_ANALYTICS !== "1", "needs a build with NEXT_PUBLIC_POSTHOG_KEY (see the file header)");

  test("missing: the banner asks, and PostHog does not load, store or send anything", async ({ page }) => {
    const requests = watchAnalyticsRequests(page);
    await catchAnalytics(page);
    await page.goto(PRODUCT);
    await expect(banner(page)).toBeVisible();
    await page.goto("/");
    await page.waitForTimeout(2500);
    expect(requests).toEqual([]);
    expect(await posthogTraces(page)).toEqual({ cookies: [], storage: [], loaded: false });
  });

  test("declined: remembered, and still nothing loads, is stored or is sent", async ({ page }) => {
    const requests = watchAnalyticsRequests(page);
    await catchAnalytics(page);
    await page.goto(PRODUCT);
    await banner(page).getByRole("button", { name: "Decline" }).click();
    await expect(banner(page)).toBeHidden();
    const cookie = (await page.context().cookies()).find((c) => c.name === CONSENT_COOKIE);
    expect(decodeURIComponent(cookie!.value)).toMatch(/^denied\.1\./);

    await page.reload();
    await page.goto("/");
    await page.waitForTimeout(2500);
    await expect(banner(page)).toBeHidden();
    expect(requests).toEqual([]);
    expect(await posthogTraces(page)).toEqual({ cookies: [], storage: [], loaded: false });
  });

  test("granted: PostHog starts then, and nothing from before the choice is sent", async ({ page }) => {
    const events = await catchAnalytics(page);
    await page.goto(PRODUCT);
    // Viewed before accepting: this product_viewed must never be sent.
    await page.waitForTimeout(1000);
    await banner(page).getByRole("button", { name: "Accept analytics" }).click();
    await expect(banner(page)).toBeHidden();

    await page.getByRole("radio", { name: /Single/ }).click();
    await page.getByRole("button", { name: /^Add to cart$/ }).first().click();
    await expect.poll(() => named(events, "product_added_to_cart").length, { timeout: 20000 }).toBe(1);
    expect(named(events, "product_viewed")).toHaveLength(0);
    const traces = await posthogTraces(page);
    expect(traces.loaded).toBe(true);
    expect(traces.cookies.length + traces.storage.length).toBeGreaterThan(0);
  });

  test("granted is remembered: PostHog starts on the next visit without asking", async ({ page, baseURL }) => {
    await setConsentCookie(page, "granted", baseURL!);
    const events = await catchAnalytics(page);
    await page.goto(PRODUCT);
    await expect(banner(page)).toBeHidden();
    await expect.poll(() => named(events, "product_viewed").length, { timeout: 20000 }).toBe(1);
  });

  test("withdrawn: PostHog stops, its identity and storage are removed, and nothing more is sent", async ({ page, baseURL }) => {
    await setConsentCookie(page, "granted", baseURL!);
    const events = await catchAnalytics(page);
    await page.goto(PRODUCT);
    await expect.poll(() => named(events, "product_viewed").length, { timeout: 20000 }).toBe(1);
    expect((await posthogTraces(page)).loaded).toBe(true);

    // From the footer, as a customer would.
    await page.getByRole("button", { name: "Analytics settings" }).click();
    await expect(banner(page)).toContainText("analytics enabled");
    await Promise.all([page.waitForEvent("load"), banner(page).getByRole("button", { name: "Withdraw consent" }).click()]);

    const requests = watchAnalyticsRequests(page);
    const cookie = (await page.context().cookies()).find((c) => c.name === CONSENT_COOKIE);
    expect(decodeURIComponent(cookie!.value)).toMatch(/^denied\.1\./);
    await page.goto("/");
    await page.waitForTimeout(2500);
    expect(requests).toEqual([]);
    expect(await posthogTraces(page)).toEqual({ cookies: [], storage: [], loaded: false });
  });

  test("Sentry keeps working whatever the analytics choice", async ({ page, baseURL }) => {
    await setConsentCookie(page, "denied", baseURL!);
    const sentry: string[] = [];
    await page.route("http://localhost:9876/**", async (route) => {
      sentry.push(route.request().postData() ?? "");
      await route.fulfill({ status: 200, body: "{}", headers: { "Access-Control-Allow-Origin": "*" } });
    });
    await page.goto("/");
    await page.evaluate(() => setTimeout(() => {
      throw new Error("consent-test error");
    }));
    await expect.poll(() => sentry.some((body) => body.includes("consent-test error")), { timeout: 15000 }).toBe(true);
    expect((await posthogTraces(page)).loaded).toBe(false);
  });
});

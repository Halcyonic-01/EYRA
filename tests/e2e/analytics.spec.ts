import { test, expect, devices } from "@playwright/test";

import { catchAnalytics, named, setConsentCookie } from "./helpers/analytics-capture";

/**
 * What the browser really sends to PostHog, on a desktop and a phone. Every
 * request to the analytics proxy (/ev) is caught in the browser and answered
 * here, so nothing reaches PostHog.
 *
 * Needs a storefront built with a PostHog key, e.g.
 *   NEXT_PUBLIC_POSTHOG_KEY=phc_e2etestkeyonly000 npm run build && npm start
 * and E2E_ANALYTICS=1 when running the tests. Skipped otherwise; the normal
 * suite runs without a key, which also proves analytics stays off then.
 */

const PERSONAL = /(^|_)(email|phone|name|address|pincode)($|_)/i;

const VIEWPORTS = [
  { name: "desktop", use: { viewport: devices["Desktop Chrome"].viewport, userAgent: devices["Desktop Chrome"].userAgent } },
  { name: "mobile", use: { viewport: devices["Pixel 7"].viewport, userAgent: devices["Pixel 7"].userAgent, isMobile: true, hasTouch: true } },
];

for (const vp of VIEWPORTS) {
  test.describe(`analytics on ${vp.name}`, () => {
    test.skip(process.env.E2E_ANALYTICS !== "1", "needs a build with NEXT_PUBLIC_POSTHOG_KEY (see the file header)");
    test.use(vp.use);

    test("a product visit and an add to bag: one event each, explicit events only, nothing personal", async ({ page, baseURL }) => {
      await setConsentCookie(page, "granted", baseURL!);
      const events = await catchAnalytics(page);
      await page.goto("/products/luna-anklet");
      await page.getByRole("radio", { name: /Single/ }).click();
      await page.getByRole("button", { name: /^Add to cart$/ }).first().click();

      await expect.poll(() => named(events, "product_added_to_cart").length, { timeout: 20000 }).toBe(1);
      expect(named(events, "product_viewed")).toHaveLength(1);
      expect(named(events, "product_viewed")[0].properties).toMatchObject({ product_type: "anklet", in_stock: true });
      expect(named(events, "product_added_to_cart")[0].properties).toMatchObject({ quantity: 1, price: 2000 });
      expect(named(events, "$pageview").length).toBeGreaterThanOrEqual(1);
      // No autocapture, no identify for a visitor who is not signed in.
      expect(named(events, "$autocapture")).toHaveLength(0);
      expect(named(events, "$identify")).toHaveLength(0);
      for (const event of events) {
        for (const key of Object.keys(event.properties ?? {})) expect(key.startsWith("$") || !PERSONAL.test(key)).toBe(true);
      }
    });

    test("page URLs reach analytics without private tokens or query strings", async ({ page, baseURL }) => {
      await setConsentCookie(page, "granted", baseURL!);
      const events = await catchAnalytics(page);
      await page.goto("/review/PRIVATETOKEN1234567890?utm_source=whatsapp&email=a%40b.com");
      await expect.poll(() => named(events, "$pageview").length, { timeout: 20000 }).toBeGreaterThanOrEqual(1);
      const sent = JSON.stringify(events);
      expect(sent).not.toContain("PRIVATETOKEN1234567890");
      expect(sent).not.toContain("a%40b.com");
      expect(sent).not.toContain("a@b.com");
      expect(named(events, "$pageview")[0].properties.$current_url).toMatch(/\/review\/\[token\]\?utm_source=whatsapp$/);
    });
  });
}

test("trailing-slash URLs still redirect to the page without a slash", async ({ request }) => {
  const res = await request.get("/about/", { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers().location).toMatch(/\/about$/);
});

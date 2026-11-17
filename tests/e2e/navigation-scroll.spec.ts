import { test, expect, type Page } from "@playwright/test";

// A newly opened page starts at its top, on a phone and on a desktop. Runs against the real
// dev server and needs the Medusa backend for the product pages.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const y = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const scrollTo = (page: Page, top: number) => page.evaluate((t) => window.scrollTo({ top: t, behavior: "instant" }), top);
const settle = (page: Page) => page.waitForTimeout(1500);

test.describe("page position after navigating", () => {
  test("tapping a product from deep in the listing opens it at the very top, every time", async ({ page }) => {
    for (let i = 0; i < 6; i++) {
      await page.goto("/products");
      await settle(page);
      await scrollTo(page, 900 + 400 * (i % 3));
      const link = page.locator('a[href^="/products/"]').nth(2 + i);
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await page.waitForURL(/\/products\/[^/]+$/);
      await settle(page);
      expect(await y(page), `trial ${i + 1}`).toBe(0);
    }
  });

  test("the announcement bar and the header are in view on arrival", async ({ page }) => {
    await page.goto("/products");
    await settle(page);
    await scrollTo(page, 1700);
    const link = page.locator('a[href^="/products/"]').nth(4);
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await page.waitForURL(/\/products\/[^/]+$/);
    await settle(page);
    const nav = (await page.getByRole("banner").boundingBox())!;
    expect(nav.y).toBeGreaterThanOrEqual(0);
    expect(await y(page)).toBe(0);
    // The gallery starts below the header, not under it.
    const gallery = (await page.getByRole("button", { name: "View image full screen" }).boundingBox())!;
    expect(gallery.y).toBeGreaterThan(nav.y + nav.height);
  });

  test("going to another product from a scrolled product page opens it at the top", async ({ page }) => {
    await page.goto("/products/sovereign-signet-ring");
    await settle(page);
    const similar = page.locator('a[href^="/products/"]').filter({ hasNot: page.locator('[aria-label="Cart"]') }).last();
    await similar.scrollIntoViewIfNeeded();
    const before = await y(page);
    expect(before).toBeGreaterThan(500);
    await similar.click();
    await page.waitForURL((url) => url.pathname !== "/products/sovereign-signet-ring");
    await settle(page);
    expect(await y(page)).toBe(0);
  });

  test("a menu link from a scrolled page opens the new page at the top", async ({ page }) => {
    await page.goto("/products");
    await settle(page);
    await scrollTo(page, 1500);
    await page.getByRole("banner").getByRole("link", { name: "EYRA Home" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await settle(page);
    expect(await y(page)).toBe(0);
  });

  test("back returns to where the customer was, not forced to the top", async ({ page }) => {
    await page.goto("/products");
    await settle(page);
    await scrollTo(page, 1400);
    const link = page.locator('a[href^="/products/"]').nth(5);
    await link.scrollIntoViewIfNeeded();
    const left = await y(page);
    await link.click();
    await page.waitForURL(/\/products\/[^/]+$/);
    await settle(page);
    expect(await y(page)).toBe(0);
    await page.goBack();
    await page.waitForURL(/\/products$/);
    await settle(page);
    expect(await y(page)).toBeGreaterThan(left / 2);
  });

  test("a collection filter keeps its place on the page instead of jumping up", async ({ page }) => {
    await page.goto("/collections/for-her");
    await settle(page);
    await scrollTo(page, 250);
    const before = await y(page);
    expect(before).toBeGreaterThan(100);
    // Triggered directly, so the test itself does not scroll the page to reach the button.
    await page.locator('a[href="/collections/for-her?filter=pendants"]').evaluate((a: HTMLAnchorElement) => a.click());
    await page.waitForURL(/filter=pendants/);
    await settle(page);
    // The safeguard ignores same-page changes: the page stays where the customer was.
    expect(await y(page)).toBeGreaterThan(100);
  });
});

test.describe("on a desktop too", () => {
  test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false });

  test("opening a product from a scrolled listing starts at the top", async ({ page }) => {
    await page.goto("/products");
    await settle(page);
    await scrollTo(page, 1200);
    const link = page.locator('a[href^="/products/"]').nth(3);
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await page.waitForURL(/\/products\/[^/]+$/);
    await settle(page);
    expect(await y(page)).toBe(0);
  });
});

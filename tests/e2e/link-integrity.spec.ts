import { test, expect } from "@playwright/test";

/**
 * Crawls every internal link reachable from the main entry points and asserts
 * none of them 404. This is the regression guard for the nav and footer links
 * that previously all pointed at routes that did not exist.
 */

const ENTRY_POINTS = [
  "/",
  "/products",
  "/collections",
  "/new-arrivals",
  "/about",
  "/contact",
  "/craftsmanship",
  "/sustainability",
  "/careers",
  "/support",
  "/cart",
  "/wishlist",
  "/privacy-policy",
  "/terms-of-service",
  "/shipping-policy",
  "/refund-policy",
  "/grievance-redressal",
  "/authenticity-and-care",
  "/best-sellers",
];

// The crawls load every entry page one after another, and a dev server takes a few
// seconds for each, so they get longer than the default minute. They only need the
// status and the links in the HTML, not images and scripts, so they do not wait for "load".
const CRAWL_TIMEOUT = 300_000;

/** Routes that intentionally redirect guests to sign-in. */
const AUTH_GATED = ["/checkout", "/orders", "/account"];

test("no page in the site renders the 404 boundary", async ({ page }) => {
  test.setTimeout(CRAWL_TIMEOUT);
  for (const path of ENTRY_POINTS) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} returned ${response?.status()}`).toBeLessThan(400);

    // The branded 404 renders this copy; a real page must not.
    await expect(
      page.getByRole("heading", { name: /page not found/i }),
      `${path} rendered the 404 page`
    ).toHaveCount(0);
  }
});

test("every internal link found on entry pages resolves", async ({ page }) => {
  test.setTimeout(CRAWL_TIMEOUT);
  const seen = new Set<string>();
  const broken: string[] = [];

  for (const path of ENTRY_POINTS) {
    await page.goto(path, { waitUntil: "domcontentloaded" });

    const hrefs = await page.locator("a[href^='/']").evaluateAll((anchors) =>
      anchors.map((a) => a.getAttribute("href") ?? "")
    );

    for (const href of hrefs) {
      const clean = href.split("#")[0];
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);

      // Auth-gated routes redirect rather than render; covered separately.
      if (AUTH_GATED.some((r) => clean.startsWith(r))) continue;

      const res = await page.request.get(clean, { maxRedirects: 5 });
      if (res.status() >= 400) broken.push(`${clean} -> ${res.status()} (linked from ${path})`);
    }
  }

  expect(seen.size, "expected to discover internal links").toBeGreaterThan(15);
  expect(broken, `broken links:\n${broken.join("\n")}`).toEqual([]);
});

test("collection aliases redirect to their canonical URL", async ({ page }) => {
  await page.goto("/collections/chains");
  await expect(page).toHaveURL(/\/collections\/pendants$/);

  await page.goto("/collections/new");
  await expect(page).toHaveURL(/\/new-arrivals$/);
});

test("an unknown collection slug shows the branded 404", async ({ page }) => {
  await page.goto("/collections/does-not-exist");
  await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
});

/**
 * Missing pages must answer with a real 404 status, not a 200 carrying 404
 * markup. A root app/loading.tsx used to open a Suspense boundary that
 * committed a 200 before any page could call notFound(), turning every missing
 * product and collection into a soft 404 that crawlers index as a real page.
 * These assertions read the status directly so that cannot regress silently.
 */
test.describe("HTTP status codes", () => {
  test("missing pages return a real 404", async ({ request }) => {
    for (const path of [
      "/collections/does-not-exist",
      "/products/nope-does-not-exist",
      "/totally-fake-page",
    ]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), `${path} should be 404`).toBe(404);
    }
  });

  test("real pages return 200", async ({ request }) => {
    for (const path of ["/", "/collections", "/collections/rings", "/collections/bracelets", "/new-arrivals", "/about"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), `${path} should be 200`).toBe(200);
    }
  });

  test("collection aliases answer with a redirect status", async ({ request }) => {
    const res = await request.get("/collections/chains", { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(res.headers()["location"]).toContain("/collections/pendants");
  });
});

import { readFileSync } from "node:fs";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// The "% off" a customer sees on the product page and in the cart, against the
// real Medusa backend. Skipped when the backend is not running.

function localEnv(key: string): string {
  if (process.env[key]) return process.env[key] as string;
  try {
    const line = readFileSync(".env.local", "utf8")
      .split("\n")
      .find((entry) => entry.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim().replace(/^"|"$/g, "") : "";
  } catch {
    return "";
  }
}

const BACKEND = localEnv("NEXT_PUBLIC_MEDUSA_BACKEND_URL") || "http://localhost:9000";

async function backendReady(request: APIRequestContext): Promise<boolean> {
  try {
    return (await request.get(`${BACKEND}/health`, { timeout: 5000 })).ok();
  } catch {
    return false;
  }
}

test.beforeEach(async ({ request }) => {
  test.skip(!(await backendReady(request)), "the Medusa backend is not running");
});

/** The number in the "NN% off" badge on a product page, or 0 when there is none. */
async function pagePercent(page: Page): Promise<number> {
  const badge = page.getByText(/^\d+% off$/);
  if ((await badge.count()) === 0) return 0;
  return Number.parseInt((await badge.first().innerText()).replace(/\D/g, ""), 10);
}

async function cartPercents(page: Page): Promise<number[]> {
  const labels = await page.getByText(/^\d+% OFF$/).allInnerTexts();
  return labels.map((label) => Number.parseInt(label.replace(/\D/g, ""), 10));
}

test.describe("% off on the product page and in the cart", () => {
  test("every product shows a discount between 35% and 50%, and they are not all the same", async ({ page }) => {
    await page.goto("/products");
    const hrefs = await page.locator('article a[href^="/products/"]').evaluateAll((links) =>
      [...new Set(links.map((a) => (a as HTMLAnchorElement).getAttribute("href") as string))]
    );
    expect(hrefs.length).toBeGreaterThan(3);
    const seen = new Set<number>();
    for (const href of hrefs) {
      await page.goto(href);
      const pct = await pagePercent(page);
      expect(pct, href).toBeGreaterThanOrEqual(35);
      expect(pct, href).toBeLessThanOrEqual(50);
      seen.add(pct);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test("the cart shows the same % off as the product page, for Single and for Pair", async ({ page }) => {
    const onPage: Record<string, number> = {};
    for (const pack of ["Single", "Pair"]) {
      await page.goto("/products/luna-anklet");
      await page.getByRole("radio", { name: new RegExp(pack, "i") }).click();
      onPage[pack] = await pagePercent(page);
      expect(onPage[pack]).toBeGreaterThanOrEqual(35);
      await page.getByRole("button", { name: /^Add to cart$/ }).first().click();
      await expect(page.getByRole("button", { name: "Added to cart" }).first()).toBeVisible();
      await page.waitForTimeout(1200);
    }
    // One product, one discount: Single and Pair agree to within rounding.
    expect(Math.abs(onPage.Single - onPage.Pair)).toBeLessThanOrEqual(1);

    await page.goto("/cart");
    await expect(page.getByText("Luna Anklet").first()).toBeVisible();
    const inCart = await cartPercents(page);
    expect(inCart.sort()).toEqual([onPage.Single, onPage.Pair].sort());
  });

  test("a cart saved with the old fixed discount is moved to the product's own", async ({ page }) => {
    await page.goto("/products/luna-anklet");
    const expected = await pagePercent(page);
    // A cart as the old storefront saved it: original price = price x 1.6.
    await page.evaluate(() => {
      const product = {
        id: "luna-anklet", name: "Luna Anklet", price: 2000, originalPrice: 3200,
        description: "", images: [], inStock: 5, type: "anklet", audiences: [],
      };
      localStorage.setItem(
        "eyra-cart-storage",
        JSON.stringify({
          state: { cartId: null, items: [{ product, size: null, quantity: 1, unitPrice: 2000, originalUnitPrice: 3200, variantLabel: null }] },
          version: 2,
        })
      );
    });
    await page.goto("/cart");
    await expect(page.getByText("Luna Anklet").first()).toBeVisible();
    expect(await cartPercents(page)).toEqual([expected]);
  });
});

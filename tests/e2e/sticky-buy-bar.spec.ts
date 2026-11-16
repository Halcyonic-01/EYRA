import { readFileSync } from "node:fs";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// The Buy now / Add to cart bar that stays at the bottom of a product page
// once the page's own buttons have scrolled away. Runs against the real Medusa
// backend and is skipped when it is not running.

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

const bar = (page: Page) => page.getByRole("region", { name: "Quick purchase" });
const scrollTo = (page: Page, y: number | "end") =>
  page.evaluate((target) => window.scrollTo({ top: target === "end" ? document.documentElement.scrollHeight : target, behavior: "instant" }), y);

test.describe("sticky buy bar", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendReady(request)), "the Medusa backend is not running");
  });

  test("desktop: hidden while the page's own buttons show, then fixed to the bottom of the screen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/products/luna-anklet");
    await expect(page.getByRole("button", { name: "Buy now" })).toBeVisible();
    await expect(bar(page)).toHaveCount(0);

    await scrollTo(page, 1100);
    await expect(bar(page)).toBeVisible();
    const box = await bar(page).boundingBox();
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(900);
    expect(box?.width).toBe(1440);
    await expect(bar(page).getByText("Luna Anklet")).toBeVisible();
    await expect(bar(page).getByRole("button", { name: "Buy now" })).toBeVisible();

    await scrollTo(page, 0);
    await expect(bar(page)).toHaveCount(0);
  });

  test("phone: shows from the start when the page's buttons are below the fold, across the width of the screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/products/luna-anklet");
    await expect(bar(page)).toBeVisible();
    const box = await bar(page).boundingBox();
    expect(box?.width).toBe(375);
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(667);
    const buttons = bar(page).getByRole("button");
    await expect(buttons).toHaveCount(2);
    for (const name of ["Buy now", "Add to cart"]) {
      const b = await bar(page).getByRole("button", { name }).boundingBox();
      expect((b?.x ?? 0) >= 0 && (b?.x ?? 0) + (b?.width ?? 0) <= 375).toBe(true);
    }
  });

  for (const [name, width, height] of [["iPad portrait", 768, 1024], ["iPad landscape", 1024, 768]] as const) {
    test(`${name}: fixed to the bottom across the screen, with room to tap and no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/products/sovereign-signet-ring");
      await scrollTo(page, 1500);
      await expect(bar(page)).toBeVisible();
      const box = await bar(page).boundingBox();
      expect(box?.width).toBe(width);
      expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(height);
      for (const label of ["Buy now", "Add to cart"]) {
        const b = await bar(page).getByRole("button", { name: label }).boundingBox();
        expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect((b?.x ?? -1) >= 0 && (b?.x ?? 0) + (b?.width ?? 0) <= width).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    });
  }

  test("the bar's Add to cart adds the piece and opens the bag", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/products/luna-anklet");
    await page.getByRole("radio", { name: /Single/ }).click();
    await scrollTo(page, 1100);
    await bar(page).getByRole("button", { name: "Add to cart" }).click();
    const bag = page.getByRole("dialog", { name: "Your bag" });
    await expect(bag).toBeVisible();
    await expect(bag.getByRole("link", { name: "Luna Anklet" })).toBeVisible();
  });

  test("a ring with no size picked: the bar's button flags the size and takes you to it, adding nothing", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/products/sovereign-signet-ring");
    await scrollTo(page, 1400);
    await bar(page).getByRole("button", { name: "Add to cart" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "select a size" });
    await expect(alert).toBeVisible();
    await expect(alert).toBeInViewport();
    await expect(page.getByRole("dialog", { name: "Your bag" })).toHaveCount(0);
  });

  test("the bar steps aside for the footer, so it never covers it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/products/luna-anklet");
    await scrollTo(page, 1100);
    await expect(bar(page)).toBeVisible();
    await scrollTo(page, "end");
    await expect(page.getByRole("contentinfo")).toBeInViewport();
    await expect(bar(page)).toHaveCount(0);
  });
});

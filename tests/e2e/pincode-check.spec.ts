import { readFileSync } from "node:fs";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// The delivery pincode box on a product page: the Check button must always be
// whole and inside the box, on any phone, and it has to work.

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

async function mockServiceability(page: Page, serviceable: boolean) {
  await page.route("**/api/shipping/serviceability", (route) =>
    route.fulfill({
      json: { serviceable, estimatedDays: 3, availablePaymentMethods: ["prepaid", "cod"] },
    })
  );
}

const input = (page: Page) => page.getByPlaceholder("Enter Pincode");
const check = (page: Page) => page.getByRole("button", { name: /^Check$/ }).last();

test.describe("pincode check on a product page", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendReady(request)), "the Medusa backend is not running");
  });

  for (const [width, textScale] of [
    [320, 1],
    [360, 1],
    [375, 1],
    [390, 1],
    [412, 1],
    [360, 1.3], // a phone with its font size turned up
    [390, 1.3],
  ] as const) {
    test(`the Check button is whole and inside the box at ${width}px${textScale > 1 ? `, text x${textScale}` : ""}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/products/luna-anklet");
      if (textScale > 1) {
        await input(page).evaluate((el, scale) => {
          el.parentElement?.querySelectorAll<HTMLElement>("input,button").forEach((n) => (n.style.fontSize = `${16 * scale}px`));
        }, textScale);
      }
      await input(page).scrollIntoViewIfNeeded();
      const box = await input(page).locator("xpath=..").boundingBox();
      const button = await check(page).boundingBox();
      expect(button && box).toBeTruthy();
      expect(button!.x).toBeGreaterThanOrEqual(box!.x);
      expect(button!.x + button!.width).toBeLessThanOrEqual(box!.x + box!.width + 0.5);
      // The box itself stays inside the screen too.
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      // Big enough to tap.
      expect(button!.height).toBeGreaterThanOrEqual(40);
    });
  }

  test("tapping Check on a phone shows the delivery estimate", async ({ page }) => {
    await mockServiceability(page, true);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/products/luna-anklet");
    await input(page).fill("560078");
    await check(page).click();
    await expect(page.getByText(/Delivery available! Arriving/)).toBeVisible();
    await expect(page.getByText(/cash on delivery available/)).toBeVisible();
  });

  test("pressing Enter in the box checks too, and an unserved pincode says so", async ({ page }) => {
    await mockServiceability(page, false);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/products/luna-anklet");
    await input(page).fill("560078");
    await input(page).press("Enter");
    await expect(page.getByText("Sorry, we don't currently deliver to this pincode.")).toBeVisible();
  });

  test("a short pincode is refused before anything is sent, and only digits are kept", async ({ page }) => {
    let sent = 0;
    await page.route("**/api/shipping/serviceability", (route) => {
      sent += 1;
      return route.abort();
    });
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/products/luna-anklet");
    await input(page).fill("56ab0");
    await expect(input(page)).toHaveValue("560");
    await check(page).click();
    await expect(page.getByText("Please enter a valid 6-digit pincode.")).toBeVisible();
    expect(sent).toBe(0);
  });

  test("the same box is on a ring's page and fits at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/products/sovereign-signet-ring");
    await input(page).scrollIntoViewIfNeeded();
    const box = await input(page).locator("xpath=..").boundingBox();
    const button = await check(page).boundingBox();
    expect(button!.x + button!.width).toBeLessThanOrEqual(box!.x + box!.width + 0.5);
  });
});

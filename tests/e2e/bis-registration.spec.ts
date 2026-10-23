import { existsSync } from "node:fs";
import { test, expect } from "@playwright/test";

// The BIS Hallmarking registration number must be on the site, and the official logo
// is shown from the file BIS publishes (it is never redrawn: it is BIS's mark).

const NUMBER = "HM/C-5890248421";
const logoSupplied = ["svg", "png", "webp", "jpg"].some((ext) => existsSync(`public/images/bis-hallmark.${ext}`));

test.describe("BIS hallmark registration", () => {
  for (const path of ["/", "/products", "/about", "/refund-policy"]) {
    test(`the footer of ${path} carries the registration number`, async ({ page }) => {
      await page.goto(path);
      const footer = page.getByRole("contentinfo");
      await expect(footer.getByTestId("bis-mark")).toContainText(NUMBER);
      await expect(footer).toContainText(`BIS Hallmarking Registration No.: ${NUMBER}`);
      await expect(footer).toContainText(`Reg. No. ${NUMBER}`);
    });
  }

  test("the authenticity page states it", async ({ page }) => {
    await page.goto("/authenticity-and-care");
    await expect(page.locator("main")).toContainText(`BIS Hallmarking registration number is ${NUMBER}`);
  });

  test("the logo shows only when the official file has been added, never a broken image", async ({ page }) => {
    await page.goto("/");
    const logos = page.getByRole("contentinfo").locator('img[alt="BIS Hallmark"]');
    await expect(logos).toHaveCount(logoSupplied ? 1 : 0);
    if (logoSupplied) {
      // The image loads lazily, so bring it into view first.
      await logos.first().scrollIntoViewIfNeeded();
      await expect(logos.first()).toBeVisible();
      await expect.poll(() => logos.first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
  });
});

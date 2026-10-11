import { test, expect } from "@playwright/test";

// Sign-in and sign-up open as a window over the dimmed shop.

for (const path of ["/sign-in", "/sign-up"]) {
  test.describe(`${path} window`, () => {
    test("opens as a dialog over the inert storefront", async ({ page }) => {
      await page.goto(path);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Continue with Google")).toBeVisible();
      await expect(page.locator("[inert]")).toHaveCount(1);
    });

    test("Escape returns to the shop", async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL("/");
    });
  });
}

test("the close button returns to the shop", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Close and return to the shop").click();
  await expect(page).toHaveURL("/");
});

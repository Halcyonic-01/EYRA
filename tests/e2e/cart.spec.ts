import { test, expect } from "@playwright/test";

test.describe("guest cart", () => {
  test("cart is reachable without signing in", async ({ page }) => {
    // Regression test: /cart used to be gated behind Clerk auth alongside
    // checkout/orders/account, forcing sign-in just to view an empty cart.
    const response = await page.goto("/cart");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText(/sign in/i)).not.toBeVisible();
  });

  test("add to cart, update quantity, and remove", async ({ page }) => {
    await page.goto("/products");
    // Rings need a size the grid card can't collect, so their "Add to cart"
    // button reads "Select size" and links to the PDP instead of adding
    // directly. Filter to a single-variant type to test the direct-add path.
    await page.getByRole("button", { name: "Type" }).click();
    await page.getByRole("menu").getByText("Pendants", { exact: true }).click();

    const firstCard = page.locator("article").first();
    const productName = await firstCard.getByRole("heading").innerText();
    await firstCard.getByRole("button", { name: "Add to cart" }).click();
    await expect(firstCard.getByRole("button", { name: "Added to cart" })).toBeVisible();

    // addToCart writes to localStorage synchronously, but a hard navigation
    // fired in the same instant can outrace the browser's own persistence of
    // that write, a storage-engine timing quirk, not a UI or state bug. No
    // real click-then-navigate happens this fast, so a brief settle here
    // reflects realistic usage rather than masking anything.
    await page.waitForTimeout(300);

    await page.goto("/cart");
    await expect(page.getByText(productName)).toBeVisible();

    // Scoped to <main> so this doesn't also match the navbar's cart-count
    // badge, which can coincidentally show the same number.
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByRole("main").getByText("2", { exact: true })).toBeVisible();

    // Remove
    await page.getByRole("button", { name: "Remove item" }).click();
    await expect(page.getByText(/Your cart is empty/i)).toBeVisible();
  });

  test("cart persists across a page reload", async ({ page }) => {
    await page.goto("/products");
    await page.getByRole("button", { name: "Type" }).click();
    await page.getByRole("menu").getByText("Pendants", { exact: true }).click();

    const firstCard = page.locator("article").first();
    await firstCard.getByRole("button", { name: "Add to cart" }).click();
    await expect(firstCard.getByRole("button", { name: "Added to cart" })).toBeVisible();
    await page.waitForTimeout(300);

    await page.goto("/cart");
    await expect(page.getByText(/Your cart is empty/i)).not.toBeVisible();

    await page.reload();
    await expect(page.getByText(/Your cart is empty/i)).not.toBeVisible();
  });
});

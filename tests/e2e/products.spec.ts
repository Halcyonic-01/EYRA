import { test, expect, type Page } from "@playwright/test";

test("products page lists products", async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: /All Products/i })).toBeVisible();

  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(0);
});

test("clicking a product navigates to its detail page", async ({ page }) => {
  // Regression test: ProductCard previously had no link to the PDP at all —
  // only "Add to cart" worked, and "Quick view" did nothing.
  await page.goto("/products");

  const firstCard = page.locator("article").first();
  const productName = await firstCard.getByRole("heading").innerText();

  await firstCard.getByRole("heading").getByRole("link").click();

  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();
});

test("search matches whole words, not substrings inside unrelated words", async ({ page }) => {
  // Search matches at word starts only, so "ring" finds rings and not words
  // that merely contain it mid-word.
  await page.goto("/products?q=ring");

  const cardTitles = await page.locator("article h3").allInnerTexts();
  expect(cardTitles.length).toBeGreaterThan(0);
  for (const title of cardTitles) {
    expect(title.toLowerCase()).not.toContain("chain");
  }
});

test("search with no exact match shows the closest products instead of nothing", async ({ page }) => {
  await page.goto("/products?q=zzzznonexistentproductzzzz");
  await expect(page.getByRole("status")).toContainText(/No exact matches for/i);
  expect(await page.locator("article").count()).toBeGreaterThan(0);
});

test("a typo is corrected and the shopper is told", async ({ page }) => {
  await page.goto("/products?q=rnig");
  await expect(page.getByRole("status")).toContainText("Showing results for “ring”");
  const cardTitles = await page.locator("article h3").allInnerTexts();
  expect(cardTitles.length).toBeGreaterThan(0);
  for (const title of cardTitles) {
    expect(title.toLowerCase()).toContain("ring");
  }
});

test("typing in the search box narrows the grid as you type", async ({ page }) => {
  await page.goto("/products");
  await page.getByRole("searchbox", { name: "Search products" }).fill("necklace");
  await expect(page.getByRole("heading", { name: /All Products/i })).not.toContainText("(0 results)");
  // Chains first (a synonym of necklace); a pendant that mentions a chain may follow.
  const cardTitles = (await page.locator("article h3").allInnerTexts()).map((t) => t.toLowerCase());
  expect(cardTitles[0]).toContain("chain");
  const firstOther = cardTitles.findIndex((t) => !t.includes("chain"));
  if (firstOther !== -1) {
    expect(cardTitles.slice(firstOther).some((t) => t.includes("chain"))).toBe(false);
  }
});

test("type filter narrows results to the selected category", async ({ page }) => {
  await page.goto("/products");

  // Open the Type dropdown, then check "Rings".
  await page.getByRole("button", { name: "Type" }).click();
  await page.getByRole("menu").getByText("Rings", { exact: true }).click();

  const cardTitles = await page.locator("article h3").allInnerTexts();
  expect(cardTitles.length).toBeGreaterThan(0);
  for (const title of cardTitles) {
    expect(title.toLowerCase()).not.toContain("chain");
  }
});

test.describe("search icon in the header", () => {
  async function searchFromHeader(page: Page, path: string, text: string) {
    await page.goto(path);
    await page.getByRole("button", { name: "Search products" }).click();
    const box = page.getByRole("searchbox", { name: "Search the store" });
    await expect(box).toBeFocused();
    await box.fill(text);
    await box.press("Enter");
  }

  for (const path of ["/", "/products", "/products/luna-anklet", "/cart"]) {
    test(`on ${path} it opens a search bar that finds products`, async ({ page }) => {
      await searchFromHeader(page, path, "anklet");
      await expect(page).toHaveURL(/\/products\?q=anklet/);
      await expect(page.locator("article").first()).toBeVisible();
      await expect(page.getByRole("searchbox", { name: "Search the store" })).toHaveCount(0);
    });
  }

  test("Escape and the close icon shut the search bar", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Search products" });
    await toggle.click();
    await expect(page.getByRole("searchbox", { name: "Search the store" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("searchbox", { name: "Search the store" })).toHaveCount(0);
    await toggle.click();
    await toggle.click();
    await expect(page.getByRole("searchbox", { name: "Search the store" })).toHaveCount(0);
  });

  test("shows matching products while typing, before Enter is pressed", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search products" }).click();
    const box = page.getByRole("searchbox", { name: "Search the store" });
    await box.pressSequentially("anklet");
    const results = page.locator('header a[href^="/products/"]');
    await expect(results.first()).toBeVisible();
    await expect(results.first()).toContainText(/anklet/i);
    await expect(page).toHaveURL(/\/$/);
    // Picking a result opens that product and closes the bar.
    await results.first().click();
    await expect(page).toHaveURL(/\/products\/[^?]+$/);
    await expect(page.getByRole("searchbox", { name: "Search the store" })).toHaveCount(0);
  });

  test("a misspelled word still shows the closest products, and the clear button empties the box", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search products" }).click();
    const box = page.getByRole("searchbox", { name: "Search the store" });
    await box.pressSequentially("ankelt");
    await expect(page.getByRole("link", { name: /anklet/i }).first()).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(box).toHaveValue("");
    await expect(box).toBeFocused();
    await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(0);
  });

  test("a search with no match says so", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search products" }).click();
    await page.getByRole("searchbox", { name: "Search the store" }).pressSequentially("zzzzqx");
    await expect(page.getByText(/No exact match|No products found/)).toBeVisible();
  });
});

test("the products page search box has one clear button, not two", async ({ page }) => {
  await page.goto("/products");
  const box = page.getByRole("searchbox", { name: "Search products" });
  await box.fill("chain");
  await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(1);
  // The browser's own cross inside a search box is hidden by a style rule on the input.
  const hidden = await page.evaluate(() =>
    [...document.styleSheets].some((sheet) =>
      [...sheet.cssRules].some((rule) => rule.cssText.includes("-webkit-search-cancel-button"))
    )
  );
  expect(hidden).toBe(true);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(box).toHaveValue("");
});

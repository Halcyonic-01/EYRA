import { test, expect } from "@playwright/test";

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

import { readFileSync } from "node:fs";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { pickSuggestions } from "../../lib/cart-suggestions";
import type { Product } from "../../components/products/types";

// The slide-out bag. The browser tests run against the real Medusa backend
// and are skipped when it is not running; the suggestion picker is pure logic.

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

const drawer = (page: Page) => page.getByRole("dialog", { name: "Your bag" });

async function addLunaSingle(page: Page) {
  await page.goto("/products/luna-anklet");
  await page.getByRole("radio", { name: /Single/ }).click();
  await page.getByRole("button", { name: /^Add to cart$/ }).first().click();
  await expect(drawer(page)).toBeVisible();
  // Let the cart sync with Medusa.
  await page.waitForTimeout(1500);
}

test.describe("slide-out bag", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendReady(request)), "the Medusa backend is not running");
  });

  test("adding on a product page opens the bag with the piece, its total and the way to checkout", async ({ page }) => {
    await addLunaSingle(page);
    const bag = drawer(page);
    await expect(bag.getByRole("link", { name: "Luna Anklet" })).toBeVisible();
    await expect(bag.getByText("Single")).toBeVisible();
    await expect(bag.getByTestId("drawer-total")).toHaveText(/₹2,000/);
    await expect(bag.getByRole("link", { name: /Checkout · ₹2,000/ })).toHaveAttribute("href", "/checkout");
    await expect(bag.getByText(/complimentary tote bag unlocked/i)).toBeVisible();
    // The page stays where it was underneath.
    await expect(page).toHaveURL(/\/products\/luna-anklet$/);
  });

  test("Escape, the close button and the dimmed page each close it, and the page scrolls again", async ({ page }) => {
    await addLunaSingle(page);
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toHaveCount(0);

    await page.getByRole("link", { name: "Cart" }).click();
    await expect(drawer(page)).toBeVisible();
    await drawer(page).getByRole("button", { name: "Close bag" }).click();
    await expect(drawer(page)).toHaveCount(0);

    await page.getByRole("link", { name: "Cart" }).click();
    await expect(drawer(page)).toBeVisible();
    await page.mouse.click(20, 400);
    await expect(drawer(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
  });

  test("changing the quantity updates the total, and removing the last piece shows an empty bag", async ({ page }) => {
    await addLunaSingle(page);
    const bag = drawer(page);
    await bag.getByRole("button", { name: "Increase quantity of Luna Anklet" }).click();
    await expect(bag.getByTestId("drawer-total")).toHaveText(/₹4,000/);
    await bag.getByRole("button", { name: "Remove Luna Anklet" }).click();
    await expect(bag.getByText("Your bag is empty")).toBeVisible();
  });

  test("View full bag goes to the bag page, where the icon opens the page instead of the drawer", async ({ page }) => {
    await addLunaSingle(page);
    await drawer(page).getByRole("link", { name: "View full bag" }).first().click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(drawer(page)).toHaveCount(0);
    await page.getByRole("link", { name: "Cart" }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(drawer(page)).toHaveCount(0);
  });

  test("adding from a product card on the listing opens the bag too", async ({ page }) => {
    await page.goto("/products");
    await page.getByRole("button", { name: "Type" }).click();
    await page.getByRole("menu").getByText("Pendants", { exact: true }).click();
    const card = page.locator("article", { hasText: "Rope Twist Chain" });
    await card.getByRole("button", { name: "Add to cart" }).click();
    await expect(drawer(page).getByRole("link", { name: "Rope Twist Chain" })).toBeVisible();
  });

  test("on a phone it is a bottom sheet across the screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await addLunaSingle(page);
    const box = await drawer(page).boundingBox();
    expect(box?.width).toBe(375);
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(812);
    await expect(drawer(page).getByRole("link", { name: /Checkout/ })).toBeInViewport();
  });
});

function product(id: string, type: Product["type"], price: number, inStock = 5): Product {
  return { id, name: id, price, originalPrice: price * 2, description: "", images: [], inStock, type };
}

test.describe("pieces suggested beside the bag", () => {
  const catalogue = [
    product("ring-a", "ring", 1899),
    product("ring-b", "ring", 2100),
    product("chain-a", "pendant", 2799),
    product("chain-b", "pendant", 1500),
    product("bracelet-a", "bracelet", 2200),
    product("sold-out", "anklet", 2000, 0),
  ];

  test("never suggests what is already in the bag or out of stock", () => {
    const ids = pickSuggestions(catalogue, ["ring-a"], 10).map((p) => p.id);
    expect(ids).not.toContain("ring-a");
    expect(ids).not.toContain("sold-out");
  });

  test("prefers a type the bag does not have, nearest in price", () => {
    const ids = pickSuggestions(catalogue, ["ring-a"]).map((p) => p.id);
    expect(ids).toEqual(["bracelet-a", "chain-b"]);
  });

  test("gives two at most, and still works with an empty bag", () => {
    expect(pickSuggestions(catalogue, [])).toHaveLength(2);
  });
});

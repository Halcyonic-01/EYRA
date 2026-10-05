import { test, expect } from "@playwright/test";

// The wallet holds real money, so the signed-out behaviour is worth pinning
// down: guests see no wallet and cannot use any wallet action.

test.describe("wallet access", () => {
  test("wallet page requires sign-in", async ({ page }) => {
    await page.goto("/wallet");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("wallet API returns an empty wallet for guests", async ({ request }) => {
    const res = await request.get("/api/wallet");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ signedIn: false, balance: 0, nextExpiry: null, transactions: [] });
  });

  test("a guest cannot apply wallet credit to a cart", async ({ request }) => {
    const res = await request.post("/api/wallet/apply", {
      data: { cartId: "cart_does_not_matter", apply: true },
    });
    expect(res.status()).toBe(401);
  });

  test("wallet actions reject malformed requests", async ({ request }) => {
    const res = await request.post("/api/wallet/apply", { data: {} });
    expect(res.status()).toBe(400);
  });
});

test.describe("return and exchange requests", () => {
  test("the request page requires sign-in", async ({ page }) => {
    await page.goto("/orders/order_does_not_matter/return");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("a guest cannot send or list requests", async ({ request }) => {
    const post = await request.post("/api/returns", { data: { orderId: "order_x" } });
    expect(post.status()).toBe(401);
    const get = await request.get("/api/returns");
    expect(get.status()).toBe(401);
  });
});

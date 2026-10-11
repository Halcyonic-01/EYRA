import { test, expect } from "@playwright/test";

// Cancelling an order is for the signed-in owner only. The rules themselves
// (window, fee, amounts) are the backend's and are tested there.

test.describe("order cancellation access", () => {
  test("a guest cannot see what can be cancelled", async ({ request }) => {
    const res = await request.get("/api/orders/order_does_not_matter/cancel");
    expect(res.status()).toBe(401);
  });

  test("a guest cannot cancel an order", async ({ request }) => {
    const res = await request.post("/api/orders/order_does_not_matter/cancel", {
      data: { reason: "changed_mind", refundMethod: "wallet" },
    });
    expect(res.status()).toBe(401);
  });

  test("the order page itself requires sign-in", async ({ page }) => {
    await page.goto("/orders/order_does_not_matter");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("the receipt page requires sign-in", async ({ page }) => {
    await page.goto("/orders/order_does_not_matter/invoice");
    await expect(page).toHaveURL(/sign-in/);
  });
});

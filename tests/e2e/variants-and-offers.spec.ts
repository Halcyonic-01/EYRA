import { readFileSync } from "node:fs";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// These run against the real Medusa backend with the launch setup and the demo
// products in place (setup-launch-commerce.ts and seed-variant-demo.ts there).
// They are skipped when the backend is not reachable or not set up.

/** The storefront's own env file, for the values the browser tests need. */
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
    const res = await request.get(`${BACKEND}/health`, { timeout: 5000 });
    return res.ok();
  } catch {
    return false;
  }
}

test.beforeEach(async ({ request }) => {
  test.skip(!(await backendReady(request)), "the Medusa backend is not running");
});

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

async function addVariant(page: Page, path: string, choice?: string) {
  await page.goto(path);
  if (choice) await page.getByRole("radio", { name: new RegExp(choice, "i") }).click();
  await page.getByRole("button", { name: /^Add to cart$/ }).click();
  await expect(page.getByRole("button", { name: "Added to cart" })).toBeVisible();
  // Let the cart sync finish before moving on.
  await page.waitForTimeout(1200);
}

test.describe("anklets: single and pair", () => {
  test("each option shows its own price and adds that variant", async ({ page }) => {
    await page.goto("/products/luna-anklet");
    await expect(page.getByRole("radio", { name: /Single/ })).toContainText(money(2000));
    await expect(page.getByRole("radio", { name: /Pair/ })).toContainText(money(3800));

    await page.getByRole("radio", { name: /Pair/ }).click();
    await expect(page.getByText(money(3800)).first()).toBeVisible();
    await page.getByRole("radio", { name: /Single/ }).click();
    await expect(page.getByText(money(2000)).first()).toBeVisible();
  });

  test("single and pair are separate cart lines at their own prices, and the cart total adds up", async ({ page }) => {
    await addVariant(page, "/products/luna-anklet", "Single");
    await addVariant(page, "/products/luna-anklet", "Pair");
    await page.goto("/cart");

    const lines = page.locator("main").getByText("Luna Anklet");
    await expect(lines).toHaveCount(2);
    await expect(page.getByText("Pair", { exact: true })).toBeVisible();
    await expect(page.getByText(money(2000)).first()).toBeVisible();
    await expect(page.getByText(money(3800)).first()).toBeVisible();

    // 2,000 + 3,800, never two singles.
    await expect(page.getByText(`Subtotal (2 items)`)).toBeVisible();
    await expect(page.locator("main").getByText(money(5800)).first()).toBeVisible();
  });

  test("the quantity of one variant does not touch the other", async ({ page }) => {
    await addVariant(page, "/products/luna-anklet", "Single");
    await addVariant(page, "/products/luna-anklet", "Pair");
    await page.goto("/cart");
    await page.getByRole("button", { name: "Increase quantity" }).first().click();
    await page.waitForTimeout(1500);
    await expect(page.locator("main").getByText(money(7800)).first()).toBeVisible(); // 2 x 2,000 + 3,800
  });
});

test.describe("pendant: with or without a silver chain", () => {
  test("the chain adds Rs 1,000 and is kept through the cart", async ({ page }) => {
    await page.goto("/products/moonstone-pendant");
    const plain = page.getByRole("radio", { name: /Pendant only/ });
    const chain = page.getByRole("radio", { name: /With silver chain/ });
    await expect(plain).toContainText(money(1800));
    await expect(chain).toContainText(money(2800));

    await chain.click();
    await page.getByRole("button", { name: /^Add to cart$/ }).click();
    await expect(page.getByRole("button", { name: "Added to cart" })).toBeVisible();
    await page.waitForTimeout(1200);

    await page.goto("/cart");
    await expect(page.getByText("With silver chain", { exact: true })).toBeVisible();
    await expect(page.locator("main").getByText(money(2800)).first()).toBeVisible();
  });
});

test.describe("complimentary tote bag", () => {
  test("above 1,499 it is added to the cart as a free line the customer cannot change", async ({ page }) => {
    await addVariant(page, "/products/moonstone-pendant", "Pendant only"); // 1,800
    await page.goto("/cart");

    await expect(page.getByText("A complimentary EYRA tote bag is included with this order.")).toBeVisible();
    await expect(page.getByText("EYRA tote bag", { exact: true })).toBeVisible();
    await expect(page.getByText("Free", { exact: true }).first()).toBeVisible();
    // The pendant can be removed; the tote has no remove button, and costs nothing.
    await expect(page.getByRole("button", { name: "Remove item" })).toHaveCount(1);
    await expect(page.locator("main").getByText(money(1800)).first()).toBeVisible();
    await expect(page.getByText("Subtotal (1 item)")).toBeVisible();
  });

  test("at exactly 1,499 it does not qualify and says how much more to add", async ({ page }) => {
    await page.goto("/products");
    await page.getByRole("button", { name: "Type" }).click();
    await page.getByRole("menu").getByText("Chains", { exact: true }).click();
    // Rope Twist Chain is 1,499: exactly the threshold, so it does not qualify.
    const card = page.locator("article", { hasText: "Rope Twist Chain" });
    await card.getByRole("button", { name: "Add to cart" }).click();
    await expect(card.getByRole("button", { name: "Added to cart" })).toBeVisible();
    await page.waitForTimeout(1200);
    await page.goto("/cart");

    await expect(page.getByText(/Add ₹1 more to get a complimentary EYRA tote bag/)).toBeVisible();
    await expect(page.getByText("EYRA tote bag", { exact: true })).toHaveCount(0);
  });

  test("it is judged on the price before any discount", async ({ page }) => {
    await addVariant(page, "/products/moonstone-pendant", "Pendant only"); // 1,800
    await page.goto("/cart");
    await page.getByLabel("Discount code").fill("WELCOME200");
    await page.getByRole("button", { name: "Apply" }).click(); // needs sign-in, so refused
    // Whatever happens to the code, the items are still 1,800, which qualifies.
    await expect(page.getByText("EYRA tote bag", { exact: true })).toBeVisible();
  });

  test("it goes again when the items no longer qualify", async ({ page }) => {
    await addVariant(page, "/products/moonstone-pendant", "Pendant only");
    await page.goto("/cart");
    await expect(page.getByText("EYRA tote bag", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Remove item" }).click();
    await expect(page.getByText("EYRA tote bag", { exact: true })).toHaveCount(0);
  });

  test("it is never listed in the shop, and its own page does not open", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByText("EYRA Tote Bag")).toHaveCount(0);
    await page.goto("/products/eyra-complimentary-tote");
    await expect(page).toHaveTitle(/Not Found/);
    await expect(page.getByRole("button", { name: /^Add to cart$/ })).toHaveCount(0);
  });

  test("the shipping policy says it, in the agreed words", async ({ page }) => {
    await page.goto("/shipping-policy");
    await expect(page.locator("main")).toContainText(
      "Complimentary promotional tote bag included with orders above ₹1,499; subject to stock availability."
    );
  });

  test("the product page says it is subject to stock availability", async ({ page }) => {
    await page.goto("/products/luna-anklet");
    await expect(page.getByText(/complimentary tote bag above ₹1,499, subject to stock availability/)).toBeVisible();
  });
});

test.describe("discount codes in the cart", () => {
  async function cartWithPair(page: Page) {
    await addVariant(page, "/products/luna-anklet", "Pair"); // 3,800
    await page.goto("/cart");
  }

  test("EYRA350 takes Rs 350 off a Rs 3,800 order and can be removed", async ({ page }) => {
    await cartWithPair(page);
    await page.getByLabel("Discount code").fill("eyra350");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("EYRA350 applied")).toBeVisible();
    await expect(page.getByText("− ₹350")).toBeVisible();
    await expect(page.locator("main").getByText(money(3450)).first()).toBeVisible();

    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByText("EYRA350 applied")).toHaveCount(0);
    await expect(page.locator("main").getByText(money(3800)).first()).toBeVisible();
  });

  test("a code that does not fit the order says why", async ({ page }) => {
    await cartWithPair(page); // 3,800 is not above EYRA650's minimum of 5,000
    await page.getByLabel("Discount code").fill("EYRA650");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.locator("p[role=alert]")).toContainText(/EYRA650/);
    await expect(page.getByText("EYRA650 applied")).toHaveCount(0);
  });

  test("WELCOME200 asks a guest to sign in", async ({ page }) => {
    await addVariant(page, "/products/moonstone-pendant", "Pendant only"); // 1,800
    await page.goto("/cart");
    await page.getByLabel("Discount code").fill("WELCOME200");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.locator("p[role=alert]")).toContainText(/Sign in/i);
  });

  test("retired codes and FREESHIP are not accepted", async ({ page }) => {
    await cartWithPair(page);
    for (const code of ["WELCOME10", "LAUNCH20", "FREESHIP"]) {
      await page.getByLabel("Discount code").fill(code);
      await page.getByRole("button", { name: "Apply" }).click();
      await expect(page.locator("p[role=alert]")).toBeVisible();
    }
  });
});

test.describe("what the browser is told is not trusted", () => {
  test("a tampered cart price is replaced by the one Medusa charges", async ({ page }) => {
    await addVariant(page, "/products/luna-anklet", "Pair");
    // Pretend the saved cart says the pair costs Rs 1.
    await page.evaluate(() => {
      const raw = localStorage.getItem("eyra-cart-storage");
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const item of data.state.items) item.unitPrice = 1;
      localStorage.setItem("eyra-cart-storage", JSON.stringify(data));
    });
    await page.goto("/cart");
    await expect(page.locator("main").getByText(money(3800)).first()).toBeVisible();
    await expect(page.locator("main").getByText("₹1", { exact: true })).toHaveCount(0);
  });

  test("the pricing route takes no amounts and sets the charge by method", async ({ request }) => {
    const pub = localEnv("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY");
    const headers = { "x-publishable-api-key": pub };
    const created = await request.post(`${BACKEND}/store/carts`, { headers, data: { currency_code: "inr" } });
    const cartId = (await created.json()).cart.id as string;

    const products = await request.get(`${BACKEND}/store/products?handle=luna-anklet&fields=*variants.options,*options`, { headers });
    const variants = (await products.json()).products[0].variants as { id: string; title: string }[];
    const single = variants.find((variant) => variant.title === "Single")!;
    await request.post(`${BACKEND}/store/carts/${cartId}/line-items`, { headers, data: { variant_id: single.id, quantity: 1 } });

    // Amounts in the body are ignored; only the mode counts.
    const cod = await request.post("/api/checkout/pricing", {
      data: { cartId, mode: "cod", wallet: "off", total: 1, shipping_total: 0 },
    });
    expect(cod.ok()).toBe(true);
    const codCart = (await cod.json()).cart;
    expect(codCart.totals.shipping_total).toBe(99);
    expect(codCart.totals.total).toBe(2099);

    const prepaid = await request.post("/api/checkout/pricing", { data: { cartId, mode: "prepaid", wallet: "off" } });
    const prepaidCart = (await prepaid.json()).cart;
    expect(prepaidCart.totals.shipping_total).toBe(0);
    expect(prepaidCart.totals.total).toBe(2000);

    // Repeating a method does not stack the charge.
    await request.post("/api/checkout/pricing", { data: { cartId, mode: "cod", wallet: "off" } });
    const again = await request.post("/api/checkout/pricing", { data: { cartId, mode: "cod", wallet: "off" } });
    expect((await again.json()).cart.totals.total).toBe(2099);

    const bad = await request.post("/api/checkout/pricing", { data: { cartId, mode: "free" } });
    expect(bad.status()).toBe(400);
  });

  test("placing an order needs a signed-in customer, whatever email is sent", async ({ request }) => {
    for (const path of ["/api/cod/complete", "/api/razorpay/create-order", "/api/wallet/pay"]) {
      const res = await request.post(path, {
        data: { cartId: "cart_x", email: "someone@example.com", shippingAddress: { fullName: "x" } },
      });
      expect(res.status()).toBe(401);
    }
  });
});

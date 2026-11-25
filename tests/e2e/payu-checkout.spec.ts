import fs from "node:fs";
import path from "node:path";
import { test, expect, devices, type Page } from "@playwright/test";

import { submitHostedForm } from "../../lib/payu-redirect";
import type { PayuCheckoutForm } from "../../lib/payu";
import { FAKE_PAYU_PORT, signedResponse, startFakePayu } from "./helpers/fake-payu";

/**
 * PayU hosted checkout, end to end, on a desktop and a phone: the backend opens
 * the attempt and signs the form, the browser is posted to (a fake) PayU, the
 * customer pays, fails, cancels or leaves it pending, PayU posts them back to
 * the storefront, and the status page shows what the backend decided.
 *
 * Needs the local stack: the backend on NEXT_PUBLIC_MEDUSA_BACKEND_URL started
 * with PAYU_CHECKOUT_URL / PAYU_API_URL pointing at http://127.0.0.1:19443 and
 * the e2e key and salt, a region listing pp_payu_payu, and this storefront built
 * with NEXT_PUBLIC_PAYU_ENABLED=true and EMAIL_MODE=off. Skipped otherwise.
 *
 * The "Pay" button on /checkout itself sits behind Clerk sign-in, which these
 * tests cannot pass without creating users in the shared Clerk instance, so the
 * carts are prepared through the backend exactly as /api/payu/create-session does.
 */

function localEnv(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const file = fs.readFileSync(path.join(__dirname, "../../.env.local"), "utf8");
    return file.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const BACKEND = (localEnv("NEXT_PUBLIC_MEDUSA_BACKEND_URL") ?? "http://localhost:9000").replace(/\/$/, "");
const PUB_KEY = localEnv("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY") ?? "";

async function store<T>(route: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BACKEND}${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "x-publishable-api-key": PUB_KEY },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as T };
}

type Variant = { id: string; inventory_quantity?: number | null; manage_inventory?: boolean };
type Product = { handle: string; variants?: Variant[] };

/** A prepaid cart with one item, an email and an address, as /api/payu/create-session leaves it, and its PayU form. */
async function payuCart(): Promise<{ cartId: string; form: PayuCheckoutForm } | { skip: string }> {
  let regions;
  try {
    regions = await store<{ regions: { id: string; currency_code: string }[] }>("/store/regions");
  } catch {
    return { skip: `backend not reachable at ${BACKEND}` };
  }
  const region = regions.data.regions?.find((r) => r.currency_code === "inr");
  if (!region) return { skip: "no INR region" };

  const products = await store<{ products: Product[] }>(
    `/store/products?region_id=${region.id}&limit=50&fields=handle,*variants,+variants.inventory_quantity`
  );
  const variant = products.data.products
    ?.filter((p) => p.handle !== "eyra-complimentary-tote")
    .flatMap((p) => p.variants ?? [])
    .find((v) => v.manage_inventory === false || (v.inventory_quantity ?? 0) > 2);
  if (!variant) return { skip: "no product in stock" };

  const cart = await store<{ cart: { id: string } }>("/store/carts", { region_id: region.id });
  const cartId = cart.data.cart.id;
  await store(`/store/carts/${cartId}/line-items`, { variant_id: variant.id, quantity: 1 });
  await store(`/store/carts/${cartId}`, {
    email: "payu-e2e@example.com",
    shipping_address: {
      first_name: "Asha", last_name: "Test", phone: "9999999999", address_1: "1 Test Street",
      city: "Bengaluru", province: "Karnataka", postal_code: "560001", country_code: "in",
    },
  });
  const mode = await store(`/store/carts/${cartId}/payment-mode`, { mode: "prepaid" });
  if (mode.status !== 200) return { skip: `payment mode refused (${mode.status})` };

  const session = await store<{ form?: PayuCheckoutForm; message?: string }>(`/store/carts/${cartId}/payu-session`, {});
  if (session.status !== 200 || !session.data.form) return { skip: `PayU not set up on the backend: ${session.data.message ?? session.status}` };
  if (!session.data.form.action.startsWith(`http://127.0.0.1:${FAKE_PAYU_PORT}/`)) {
    return { skip: "backend PAYU_CHECKOUT_URL does not point at the fake" };
  }
  return { cartId, form: session.data.form };
}

async function cartCompleted(cartId: string): Promise<boolean> {
  const res = await store<{ cart?: { completed_at?: string | null } }>(`/store/carts/${cartId}?fields=id,completed_at`);
  return !!res.data.cart?.completed_at;
}

/** Put the cart in this browser's saved cart, the way adding to bag would. */
async function rememberCart(page: Page, cartId: string) {
  await page.evaluate((id) => {
    localStorage.setItem("eyra-cart-storage", JSON.stringify({ state: { items: [], cartId: id }, version: 3 }));
  }, cartId);
}

const storedCartId = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("eyra-cart-storage") ?? "{}")?.state?.cartId ?? null);

// One worker, in order: the fake PayU listens on a fixed port.
test.describe.configure({ mode: "default" });

let fake: Awaited<ReturnType<typeof startFakePayu>>;
test.beforeAll(async () => {
  fake = await startFakePayu();
});
test.afterAll(async () => {
  await fake?.close();
});

const VIEWPORTS = [
  { name: "desktop", use: { viewport: devices["Desktop Chrome"].viewport, userAgent: devices["Desktop Chrome"].userAgent } },
  { name: "mobile", use: { viewport: devices["Pixel 7"].viewport, userAgent: devices["Pixel 7"].userAgent, deviceScaleFactor: devices["Pixel 7"].deviceScaleFactor, isMobile: true, hasTouch: true } },
];

for (const vp of VIEWPORTS) {
  test.describe(`PayU checkout on ${vp.name}`, () => {
    test.use(vp.use);

    async function toPayu(page: Page): Promise<{ cartId: string; form: PayuCheckoutForm }> {
      const ready = await payuCart();
      test.skip("skip" in ready, "skip" in ready ? ready.skip : "");
      const { cartId, form } = ready as { cartId: string; form: PayuCheckoutForm };
      await page.goto("/cart");
      await rememberCart(page, cartId);
      // The same function the checkout uses to leave for PayU.
      await page.evaluate(submitHostedForm, form);
      await expect(page.getByTestId("payu-page")).toBeVisible();
      await expect(page.getByTestId("payu-amount")).toHaveText(`Rs. ${form.fields.amount}`);
      return { cartId, form };
    }

    async function tap(page: Page, testId: string) {
      const button = page.getByTestId(testId);
      if (vp.name === "mobile") await button.tap();
      else await button.click();
    }

    test("a paid PayU payment places one order and clears the cart", async ({ page }) => {
      const { cartId, form } = await toPayu(page);
      await tap(page, "payu-success");

      // The status page confirms with the backend, then goes to the order (sign-in may come first).
      await page.waitForURL(/orders%2Fsuccess|orders\/success/, { timeout: 30_000 });
      const landed = decodeURIComponent(page.url());
      expect(landed).toMatch(/orderId=order_[A-Z0-9]+/);
      expect(landed).toContain("provider=payu");
      expect(await cartCompleted(cartId)).toBe(true);
      expect(await storedCartId(page)).toBeNull();

      // Asking again, or PayU's post arriving twice, finds the same order: never a second one.
      const orderId = landed.match(/orderId=(order_[A-Z0-9]+)/)![1];
      const again = await page.request.post("/api/payu/status");
      expect(await again.json()).toMatchObject({ status: "order", orderId, cartId });
      const txn = fake.txns.get(form.fields.txnid)!;
      const replay = await page.request.post("/api/payu/return", { form: signedResponse(form.fields, txn), maxRedirects: 0 });
      expect(replay.status()).toBe(303);
      const afterReplay = await page.request.post("/api/payu/status");
      expect(await afterReplay.json()).toMatchObject({ status: "order", orderId });
    });

    test("a failed payment says nothing was taken and keeps the cart", async ({ page }) => {
      const { cartId } = await toPayu(page);
      await tap(page, "payu-failure");
      await expect(page.getByTestId("payu-status-failed")).toBeVisible();
      await expect(page.getByTestId("payu-status-message")).toContainText("no money was taken");
      await expect(page.getByTestId("payu-try-again")).toHaveAttribute("href", "/checkout");
      expect(await cartCompleted(cartId)).toBe(false);
      expect(await storedCartId(page)).toBe(cartId);
    });

    test("a cancelled payment says it was cancelled", async ({ page }) => {
      const { cartId } = await toPayu(page);
      await tap(page, "payu-cancel");
      await expect(page.getByTestId("payu-status-cancelled")).toBeVisible();
      await expect(page.getByTestId("payu-status-message")).toContainText("You cancelled the payment");
      expect(await cartCompleted(cartId)).toBe(false);
    });

    test("a pending payment waits, then confirms once PayU does", async ({ page }) => {
      const { cartId, form } = await toPayu(page);
      await tap(page, "payu-pending");
      await expect(page.getByTestId("payu-status-waiting")).toBeVisible();
      await expect(page.getByTestId("payu-status-message")).toContainText("Please don't pay again");
      expect(await cartCompleted(cartId)).toBe(false);

      fake.settle(form.fields.txnid, "success");
      await page.waitForURL(/orders%2Fsuccess|orders\/success/, { timeout: 30_000 });
      expect(decodeURIComponent(page.url())).toMatch(/orderId=order_/);
      expect(await cartCompleted(cartId)).toBe(true);
    });

    test("a forged success from the browser is never treated as paid", async ({ page }) => {
      const { cartId, form } = await toPayu(page);
      // A "success" post signed with the wrong salt, as someone faking PayU would send.
      const forged = signedResponse(form.fields, { status: "success", mihpayid: "999", unmappedstatus: "captured" }, "wrongSalt");
      // Posted from the fake PayU page, cross-site, the way PayU itself posts.
      const base = test.info().project.use.baseURL ?? "http://localhost:3000";
      await page.evaluate(
        ({ action, fields }) => {
          const f = document.createElement("form");
          f.method = "POST";
          f.action = action;
          for (const [k, v] of Object.entries(fields)) {
            const i = document.createElement("input");
            i.type = "hidden"; i.name = k; i.value = v as string;
            f.appendChild(i);
          }
          document.body.appendChild(f);
          f.submit();
        },
        { action: `${base}/api/payu/return`, fields: forged }
      );
      await expect(page.getByTestId("payu-status-unverified")).toBeVisible();
      expect(await cartCompleted(cartId)).toBe(false);
    });

    test("the status page alone shows no success", async ({ page }) => {
      await page.goto("/payment-status/payu");
      await expect(page.getByTestId("payu-status-unverified")).toBeVisible();
      await expect(page.getByText("Payment confirmed")).toHaveCount(0);
    });
  });
}

test("a guest cannot open a PayU payment", async ({ request }) => {
  const res = await request.post("/api/payu/create-session", { data: { cartId: "cart_x", shippingAddress: {} } });
  const body = await res.json();
  // 401 when PayU is on, 429 once the per-IP limit is used up, a plain refusal when off. Never a form.
  expect(body.form).toBeUndefined();
  expect(res.status() === 401 || res.status() === 429 || body.error === "payu_unavailable").toBe(true);
});

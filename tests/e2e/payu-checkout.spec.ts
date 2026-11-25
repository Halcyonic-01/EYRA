import { test, expect, devices, type Page } from "@playwright/test";

import { submitHostedForm } from "../../lib/payu-redirect";
import type { PayuCheckoutForm } from "../../lib/payu";
import { signedResponse, startFakePayu } from "./helpers/fake-payu";
import { cartCompleted, payuCart, rememberCart, storedCartId } from "./helpers/backend";

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
      await expect(page.getByTestId("payu-try-again")).toHaveAttribute("href", "/checkout?method=payu");
      await expect(page.getByTestId("payu-switch-razorpay")).toHaveAttribute("href", "/checkout?method=prepaid");
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

/** What the customer sees on /payment-status for each state, on both screens. */
for (const vp of VIEWPORTS) {
  test.describe(`Payment status on ${vp.name}`, () => {
    test.use(vp.use);

    async function readyCart() {
      const ready = await payuCart();
      test.skip("skip" in ready, "skip" in ready ? ready.skip : "");
      return ready as { cartId: string; form: PayuCheckoutForm };
    }
    /** The customer reached PayU's page (PayU now knows the transaction). */
    async function reachPayu(form: PayuCheckoutForm) {
      const res = await fetch(form.action, { method: "POST", body: new URLSearchParams(form.fields) });
      expect(res.status).toBe(200);
    }
    async function openStatus(page: Page, cartId: string | null) {
      await page.goto("/cart");
      if (cartId) await rememberCart(page, cartId);
      await page.goto("/payment-status");
    }
    /** Fits the screen: no sideways scrolling, and every button is big enough to tap. */
    async function fitsScreen(page: Page) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const small = await page.locator('[data-testid="cart-payment-status"] a, [data-testid="cart-payment-status"] button').evaluateAll((els) =>
        els.filter((el) => el.getBoundingClientRect().height < 44).map((el) => el.textContent)
      );
      expect(small).toEqual([]);
    }

    test("nothing paid: says so and offers checkout", async ({ page }) => {
      const { cartId } = await readyCart();
      await openStatus(page, cartId);
      await expect(page.getByTestId("payment-status-clear")).toBeVisible();
      await expect(page.getByRole("link", { name: "Go to checkout" })).toBeVisible();
      await fitsScreen(page);
    });

    test("pending at PayU: asks not to pay again, offers no checkout, then shows it paid once PayU confirms", async ({ page, request }) => {
      const { cartId, form } = await readyCart();
      await reachPayu(form);
      fake.settle(form.fields.txnid, "pending");
      await openStatus(page, cartId);

      await expect(page.getByTestId("payment-standing-pending")).toBeVisible();
      await expect(page.getByTestId("payment-standing-message")).toContainText("Please don't pay again");
      await expect(page.getByRole("link", { name: "Go to checkout" })).toHaveCount(0);
      await fitsScreen(page);
      const api = await (await request.post("/api/checkout/payment-status", { data: { cartId } })).json();
      expect(api.payment).toMatchObject({ state: "pending", can_pay: false, allowed_providers: [] });

      fake.settle(form.fields.txnid, "success");
      await page.getByTestId("payment-standing-recheck").click();
      await expect(page.getByTestId("payment-standing-paid")).toBeVisible();
      await expect(page.getByTestId("payment-standing-message")).toContainText("Please don't pay again");
    });

    test("PayU unreachable: paying is paused rather than guessed", async ({ page }) => {
      const { cartId, form } = await readyCart();
      await reachPayu(form);
      fake.settle(form.fields.txnid, "pending");
      await fake.close();
      try {
        await openStatus(page, cartId);
        await expect(page.getByTestId("payment-standing-unknown")).toBeVisible();
        await expect(page.getByTestId("payment-standing-message")).toContainText("paying again is paused");
        await fitsScreen(page);
      } finally {
        fake = await startFakePayu();
      }
    });

    test("no cart in this browser: says where to look instead", async ({ page }) => {
      await openStatus(page, null);
      await expect(page.getByTestId("payment-status-no-cart")).toBeVisible();
      await fitsScreen(page);
    });
  });
}

test("the payment status API takes only a cart id", async ({ request }) => {
  expect((await request.post("/api/checkout/payment-status", { data: {} })).status()).toBe(400);
  expect((await request.post("/api/checkout/payment-status", { data: { cartId: "../admin" } })).status()).toBe(400);
});

test("a guest cannot open a PayU payment", async ({ request }) => {
  const res = await request.post("/api/payu/create-session", { data: { cartId: "cart_x", shippingAddress: {} } });
  const body = await res.json();
  // 401 when PayU is on, 429 once the per-IP limit is used up, a plain refusal when off. Never a form.
  expect(body.form).toBeUndefined();
  expect(res.status() === 401 || res.status() === 429 || body.error === "payu_unavailable").toBe(true);
});

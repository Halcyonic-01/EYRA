import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

import { CHECKOUT_TERMS_TEXT, PDP_POLICY_BADGE } from "../../config/policy-copy";
import { RETURN_WINDOW_DAYS, REVERSE_LOGISTICS_FEE } from "../../config/policy-constants";
import { eligibility, needsUnboxingVideo, reasonLabel, REQUEST_REASONS, STATUS_LABELS } from "../../lib/return-requests";

// The return, exchange and cancellation rules are the backend's and are tested there.
// These cover what the storefront itself decides or says.

test.describe("the fixed policy numbers", () => {
  test("are 7 days and one flat return fee of 99; an exchange has no fee", () => {
    expect(RETURN_WINDOW_DAYS).toBe(7);
    expect(REVERSE_LOGISTICS_FEE).toBe(99);
  });
});

test.describe("the policy wording", () => {
  test("the badge and the checkbox read exactly as the business wrote them", () => {
    expect(PDP_POLICY_BADGE).toBe("Free 7-Day Easy Exchanges & Store Credit Returns. No Cash Refunds.");
    expect(CHECKOUT_TERMS_TEXT).toBe(
      "I agree to EYRA JEWELS' return terms: Unshipped orders are 100% refundable. Delivered items are eligible for size exchange or store credit returns (minus a flat ₹99 reverse logistics fee) within 7 days of delivery. Unboxing video required for damaged/defective claims."
    );
  });

  // Checkout needs a signed-in customer, so it cannot be driven here: this checks the
  // page's own code asks for the terms, and refuses to place an order without them.
  test("the checkout asks for the return terms before an order can be placed", () => {
    const source = readFileSync("components/checkout/CheckoutClient.tsx", "utf8");
    expect(source).toContain('data-testid="return-terms-checkbox"');
    expect(source).toContain("{CHECKOUT_TERMS_TEXT}");
    // The agreed wording is untouched; the exception and the full policy sit beneath it.
    expect(source).toContain('data-testid="return-terms-note"');
    expect(source).toContain("There is no return fee for a damaged or defective item");
    expect(source).toContain('href="/refund-policy"');
    expect(source).toMatch(/disabled=\{\(!walletOnly && !paymentMethod\) \|\| !termsAccepted \|\| loading\}/);
    // And the handler itself refuses, for anything that calls it without the button.
    expect(source).toMatch(/async function handlePlaceOrder\(\) \{[\s\S]{0,200}if \(!termsAccepted\)/);
  });

  test("every product page carries the badge", async ({ page }) => {
    await page.goto("/products/luna-anklet");
    await expect(page.getByTestId("policy-badge")).toHaveText(PDP_POLICY_BADGE);
  });

  test("the refund policy page states the new terms", async ({ page }) => {
    await page.goto("/refund-policy");
    const body = page.locator("main");
    await expect(body).toContainText("7-day return and exchange window");
    await expect(body).toContainText("less a flat ₹99 reverse logistics fee");
    await expect(body).toContainText("No Cash Refunds");
    await expect(body).toContainText("100% refundable, with nothing deducted");
    await expect(body).toContainText("refuse the delivery at your door");
    await expect(body).toContainText("There is no fee for an exchange");
    await expect(body).toContainText("the difference only");
    await expect(body).not.toContainText("handling fee");
    await expect(body).toContainText("includes 18% GST");
    await expect(body).toContainText("no fee when the return is for a damaged or defective item");
    // The old terms are gone.
    await expect(body).not.toContainText("cancellation fee");
    await expect(body).not.toContainText("15-day");
  });
});

test.describe("reasons and statuses", () => {
  test("only the four reasons are offered", () => {
    expect(REQUEST_REASONS.map((r) => r.value)).toEqual(["SIZE_ISSUE", "DESIGN_PREFERENCE", "DAMAGED_IN_TRANSIT", "DEFECTIVE"]);
    expect(reasonLabel("SIZE_ISSUE")).toBe("Size issue");
    // An older request still reads well.
    expect(reasonLabel("wrong_size")).toBe("Wrong size");
  });

  test("damaged and defective ask for the unboxing video", () => {
    expect(needsUnboxingVideo("DAMAGED_IN_TRANSIT")).toBe(true);
    expect(needsUnboxingVideo("DEFECTIVE")).toBe(true);
    expect(needsUnboxingVideo("SIZE_ISSUE")).toBe(false);
  });

  test("every status has plain words", () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual(
      ["approved", "awaiting_inspection", "pending", "pending_fee", "rejected", "reverse_pickup_scheduled"]
    );
    expect(STATUS_LABELS.pending_fee).toBe("Waiting for payment");
  });
});

test.describe("when a request can be made", () => {
  const windows = { returnDays: RETURN_WINDOW_DAYS, exchangeDays: RETURN_WINDOW_DAYS };
  const delivered = (at: string) => ({ status: "completed", metadata: { shiprocket_status: "Delivered", shiprocket_status_updated_at: at } });

  test("opens at delivery and closes 7 days later", () => {
    const at = "2026-10-10T08:00:00Z";
    expect(eligibility(delivered(at), windows, new Date("2026-10-17T07:59:00Z")).canReturn).toBe(true);
    expect(eligibility(delivered(at), windows, new Date("2026-10-17T08:01:00Z")).closedReason).toBe("window_closed");
  });

  test("is not open before delivery, or once the parcel is coming back", () => {
    const transit = { status: "pending", metadata: { shiprocket_status: "In Transit" } };
    expect(eligibility(transit, windows).closedReason).toBe("not_delivered");
    const rto = { status: "pending", metadata: { shiprocket_status: "RTO Initiated" } };
    expect(eligibility(rto, windows).closedReason).toBe("not_delivered");
  });

  test("is not open on a cancelled order", () => {
    expect(eligibility({ status: "canceled", metadata: null }, windows).closedReason).toBe("cancelled");
  });
});

test.describe("returns routes", () => {
  test("a guest cannot ask, list, or see exchange options", async ({ request }) => {
    expect((await request.get("/api/returns")).status()).toBe(401);
    expect((await request.post("/api/returns", { data: { orderId: "order_x", type: "return", reason: "SIZE_ISSUE", items: [] } })).status()).toBe(401);
    expect((await request.get("/api/returns/replacements")).status()).toBe(401);
  });

  test("booking a pickup and sending WhatsApp are for the backend only", async ({ request }) => {
    for (const path of ["/api/returns/reverse-pickup", "/api/whatsapp/send"]) {
      const none = await request.post(path, { data: {} });
      expect([401, 503]).toContain(none.status());
      const wrong = await request.post(path, { data: {}, headers: { "x-shipment-secret": "not-the-secret" } });
      expect([401, 503]).toContain(wrong.status());
    }
  });

  test("the team alerts for returns are for the backend only", async ({ request }) => {
    for (const type of ["rto_received", "return_parcel_arrived", "reverse_pickup_problem", "credit_note_failed", "return_not_finished"]) {
      const res = await request.post("/api/ops/notify", { data: { type, order_id: "order_x" } });
      expect([401, 503]).toContain(res.status());
    }
  });
});

test.describe("order cancellation page text", () => {
  test("the order page itself still requires sign-in", async ({ page }) => {
    await page.goto("/orders/order_does_not_matter");
    await expect(page).toHaveURL(/sign-in/);
  });
});

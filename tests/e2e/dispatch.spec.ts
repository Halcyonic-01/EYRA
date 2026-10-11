import { test, expect } from "@playwright/test";

// Shipments are created by the backend's dispatcher, never by a browser, so
// the routes it uses must refuse anyone without the shared secret.

test.describe("backend-only routes", () => {
  test("creating a shipment needs the backend secret", async ({ request }) => {
    const res = await request.post("/api/shipping/create-shipment", {
      data: { medusaOrderId: "order_x", eyraOrderRef: "EYRA-1" },
    });
    // 401 normally; 503 where the secret is not configured at all.
    expect([401, 503]).toContain(res.status());
  });

  test("a wrong secret is refused", async ({ request }) => {
    const res = await request.post("/api/shipping/create-shipment", {
      headers: { "x-revalidate-secret": "not-the-secret" },
      data: { medusaOrderId: "order_x" },
    });
    expect([401, 503]).toContain(res.status());
  });

  test("ops notifications need the backend secret", async ({ request }) => {
    const res = await request.post("/api/ops/notify", {
      data: { type: "dispatch_failed", order_id: "order_x" },
    });
    expect([401, 503]).toContain(res.status());
  });
});

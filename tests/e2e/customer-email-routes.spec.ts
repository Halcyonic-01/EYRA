import http from "node:http";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { signUnsubscribe } from "../../lib/unsubscribe-token";

/**
 * The email routes of the running storefront.
 *
 * Start the dev server with the values below so nothing can be emailed and no
 * real Medusa is touched, then run this file:
 *
 *   EMAIL_MODE=off STOREFRONT_REVALIDATE_SECRET=route-test-secret \
 *   EMAIL_UNSUBSCRIBE_SECRET=route-test-unsub MEDUSA_ADMIN_API_KEY=route-test-key \
 *   NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://127.0.0.1:19321 \
 *   UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= MAILCHIMP_API_KEY= NEWSLETTER_WEBHOOK_URL= npm run dev
 *
 *   EMAIL_ROUTE_TESTS=1 STOREFRONT_REVALIDATE_SECRET=route-test-secret \
 *   EMAIL_UNSUBSCRIBE_SECRET=route-test-unsub npx playwright test customer-email-routes
 *
 * Without EMAIL_ROUTE_TESTS this file is skipped.
 */
const ENABLED = !!process.env.EMAIL_ROUTE_TESTS;
const SECRET = process.env.STOREFRONT_REVALIDATE_SECRET ?? "";
const MEDUSA_PORT = 19321;

test.skip(!ENABLED, "set EMAIL_ROUTE_TESTS=1 and start the dev server as described at the top");

test.describe("/api/wallet/notify", () => {
  const post = (request: APIRequestContext, body: Record<string, unknown>, secret: string | null = SECRET) =>
    request.post("/api/wallet/notify", {
      data: body,
      headers: secret === null ? {} : { "x-revalidate-secret": secret },
    });

  test("refuses a caller without the shared secret", async ({ request }) => {
    expect((await post(request, { type: "order_shipped", email: "a@b.com" }, null)).status()).toBe(401);
    expect((await post(request, { type: "order_shipped", email: "a@b.com" }, "wrong")).status()).toBe(401);
  });

  test("checks what each new message needs", async ({ request }) => {
    const email = "asha@example.com";
    for (const body of [
      { type: "order_shipped", email },
      { type: "order_delivered", email, order_number: 1 },
      { type: "refund_processed", email, order_number: 1, refund_amount: 100 },
      { type: "welcome_offer", email, code: "WELCOME200" },
      { type: "promotion", email, subject: "s" },
    ]) {
      expect((await post(request, body)).status(), body.type).toBe(400);
    }
    expect((await post(request, { type: "order_shipped", email: "not-an-email", order_number: 1, order_id: "o" })).status()).toBe(400);
  });

  test("refuses a promotion whose link leads off the site", async ({ request }) => {
    const res = await post(request, {
      type: "promotion",
      email: "asha@example.com",
      subject: "Offer",
      headline: "Hello",
      message: "Hi",
      cta_label: "Go",
      cta_url: "https://evil.example/phish",
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/EYRA site/);
  });

  test("accepts well-formed messages and reports that nothing was sent while email is off", async ({ request }) => {
    const email = "asha@example.com";
    for (const body of [
      { type: "order_shipped", email, order_id: "order_1", order_number: 7, awb: "AWB1", courier: "Delhivery", idempotency_key: "shipped:order_1" },
      { type: "order_delivered", email, order_id: "order_1", order_number: 7 },
      { type: "refund_processed", email, order_number: 7, refund_amount: 1901, reason: "your parcel was returned to us", credit_note: "CN/26-27/0001" },
      { type: "welcome_offer", email, code: "WELCOME200", amount: 200, min_order: 1499 },
      {
        type: "promotion",
        email,
        subject: "Offer",
        headline: "Hello",
        message: "Hi",
        cta_label: "Shop",
        cta_url: "https://www.eyra.org.in/products",
        code: "EYRA350",
        amount: 350,
        min_order: 3000,
      },
    ]) {
      const res = await post(request, body);
      expect(res.status(), body.type).toBe(200);
      expect(await res.json(), body.type).toEqual({ sent: false });
    }
  });
});

test.describe("/api/newsletter/unsubscribe", () => {
  type Seen = { method: string; url: string; body: string };
  let medusa: http.Server;
  let seen: Seen[] = [];
  let customers: { id: string }[] = [{ id: "cus_1" }];

  test.beforeAll(async () => {
    medusa = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        seen.push({ method: req.method ?? "", url: req.url ?? "", body: Buffer.concat(chunks).toString() });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(req.method === "GET" ? { customers } : { customer: { id: "cus_1" } }));
      });
    });
    await new Promise<void>((resolve) => medusa.listen(MEDUSA_PORT, "127.0.0.1", resolve));
  });
  test.afterAll(async () => {
    await new Promise((resolve) => medusa.close(resolve));
  });
  test.beforeEach(() => {
    seen = [];
    customers = [{ id: "cus_1" }];
  });

  const link = (email: string) => {
    const token = signUnsubscribe(email, process.env)!;
    return `/api/newsletter/unsubscribe?e=${encodeURIComponent(email)}&t=${token}`;
  };

  test("a link with a bad token is refused and changes nothing", async ({ request }) => {
    const get = await request.get("/api/newsletter/unsubscribe?e=asha%40example.com&t=nope");
    expect(get.status()).toBe(400);
    const post = await request.post("/api/newsletter/unsubscribe?e=asha%40example.com&t=nope");
    expect(post.status()).toBe(400);
    expect(seen).toHaveLength(0);
  });

  test("a good link only asks for confirmation, so a mail scanner opening it unsubscribes nobody", async ({ request }) => {
    const res = await request.get(link("asha@example.com"));
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("asha@example.com");
    expect(html).toContain('method="post"');
    expect(html).toContain("noindex");
    expect(seen).toHaveLength(0);
  });

  test("confirming turns off the subscriber tag on that customer, and nothing else", async ({ request }) => {
    const res = await request.post(link("asha@example.com"));
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("unsubscribed");

    expect(seen).toHaveLength(2);
    expect(seen[0].url).toContain("/admin/customers?email=asha%40example.com");
    expect(seen[1]).toMatchObject({ method: "POST", url: "/admin/customers/cus_1" });
    const sent = JSON.parse(seen[1].body);
    expect(Object.keys(sent)).toEqual(["metadata"]);
    expect(sent.metadata.newsletter_subscriber).toBe(false);
    expect(sent.metadata.unsubscribed_at).toBeTruthy();
  });

  test("the same answer whether or not the address is on the list", async ({ request }) => {
    customers = [];
    const res = await request.post(link("nobody@example.com"));
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("unsubscribed");
    expect(seen.filter((s) => s.method === "POST")).toHaveLength(0);
  });
});

test.describe("/api/newsletter/subscribe", () => {
  type Seen = { method: string; url: string; body: string };
  type Existing = { id: string; metadata: Record<string, unknown> | null };
  let medusa: http.Server;
  let seen: Seen[] = [];
  let existing: Existing | null = null;

  test.beforeAll(async () => {
    medusa = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        seen.push({ method: req.method ?? "", url: req.url ?? "", body: Buffer.concat(chunks).toString() });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(req.method === "GET" ? { customers: existing ? [existing] : [] } : { customer: { id: "cus_x" } }));
      });
    });
    await new Promise<void>((resolve) => medusa.listen(MEDUSA_PORT, "127.0.0.1", resolve));
  });
  test.afterAll(async () => {
    await new Promise((resolve) => medusa.close(resolve));
  });
  test.beforeEach(() => {
    seen = [];
    existing = null;
  });

  const subscribe = (request: APIRequestContext, email: string) =>
    request.post("/api/newsletter/subscribe", { data: { email } });
  const writes = () => seen.filter((s) => s.method === "POST");

  test("a new address becomes a customer tagged as a subscriber", async ({ request }) => {
    expect((await subscribe(request, "new@example.com")).status()).toBe(200);

    expect(writes()).toHaveLength(1);
    expect(writes()[0].url).toBe("/admin/customers");
    const sent = JSON.parse(writes()[0].body);
    expect(sent.email).toBe("new@example.com");
    expect(sent.metadata.newsletter_subscriber).toBe(true);
  });

  test("an existing customer who subscribes is tagged, so they are on the list", async ({ request }) => {
    existing = { id: "cus_1", metadata: { note: "guest checkout" } };
    expect((await subscribe(request, "old@example.com")).status()).toBe(200);

    expect(writes()).toHaveLength(1);
    expect(writes()[0].url).toBe("/admin/customers/cus_1");
    const sent = JSON.parse(writes()[0].body);
    expect(Object.keys(sent)).toEqual(["metadata"]);
    expect(sent.metadata.newsletter_subscriber).toBe(true);
    expect(sent.metadata.subscribed_at).toBeTruthy();
  });

  test("someone who unsubscribed and signs up again is put back on the list", async ({ request }) => {
    existing = { id: "cus_1", metadata: { newsletter_subscriber: false, unsubscribed_at: "2026-10-01T00:00:00Z" } };
    expect((await subscribe(request, "back@example.com")).status()).toBe(200);

    expect(writes()).toHaveLength(1);
    const sent = JSON.parse(writes()[0].body);
    expect(sent.metadata.newsletter_subscriber).toBe(true);
    expect(sent.metadata.unsubscribed_at).toBe("");
  });

  test("someone already subscribed changes nothing", async ({ request }) => {
    existing = { id: "cus_1", metadata: { newsletter_subscriber: true } };
    expect((await subscribe(request, "already@example.com")).status()).toBe(200);
    expect(writes()).toHaveLength(0);
  });

  test("a bad address is refused and Medusa is not touched", async ({ request }) => {
    expect((await subscribe(request, "not-an-email")).status()).toBe(422);
    expect(seen).toHaveLength(0);
  });
});

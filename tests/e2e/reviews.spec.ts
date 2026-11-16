import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * The whole review journey against the real Medusa backend: an order is
 * delivered through the Shiprocket webhook, the customer reviews it with a
 * photo from the private link on a phone, our team approves it, and it shows on
 * the product page. Nothing is sent to anyone: locally email runs in test mode
 * and no WhatsApp provider is set up.
 *
 * Needs the backend (with this branch) on :9000 and its folder for the fixture
 * script (REVIEW_BACKEND_DIR, default ../eyra-backend-reviews/apps/backend), and
 * SHIPROCKET_WEBHOOK_SECRET in the backend set to REVIEW_E2E_SHIPROCKET_SECRET
 * (default "local-review-e2e"). Skipped when any of that is missing.
 */

function localEnv(key: string): string {
  if (process.env[key]) return process.env[key] as string;
  try {
    const line = readFileSync(".env.local", "utf8").split("\n").find((entry) => entry.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim().replace(/^"|"$/g, "") : "";
  } catch {
    return "";
  }
}

const BACKEND = localEnv("NEXT_PUBLIC_MEDUSA_BACKEND_URL") || "http://localhost:9000";
const ADMIN = { Authorization: `Basic ${localEnv("MEDUSA_ADMIN_API_KEY")}` };
const HOOK_SECRET = process.env.REVIEW_E2E_SHIPROCKET_SECRET || "local-review-e2e";
const BACKEND_DIR = path.resolve(process.env.REVIEW_BACKEND_DIR || "../eyra-backend-reviews/apps/backend");
const PRODUCT = "luna-anklet";
// Each run's words are its own, so an earlier run's reviews cannot be mistaken for this one's.
const RUN = Date.now().toString(36);

type Fixture = { order_id: string; display_id: number; awb: string; email: string; customer_id: string };

function makeOrder(): Fixture {
  const out = execFileSync("npx", ["medusa", "exec", "./src/scripts/dev-review-fixture.ts"], {
    cwd: BACKEND_DIR,
    env: { ...process.env, PRODUCT },
    encoding: "utf8",
    timeout: 120_000,
  });
  const line = out.split("\n").find((l) => l.startsWith("REVIEW_FIXTURE "));
  if (!line) throw new Error("the fixture script printed no order");
  return JSON.parse(line.slice("REVIEW_FIXTURE ".length)) as Fixture;
}

async function deliver(request: APIRequestContext, order: Fixture) {
  const res = await request.post(`${BACKEND}/webhooks/shiprocket/order-update`, {
    headers: { "x-api-key": HOOK_SECRET },
    data: { order_id: `EYRA-${order.display_id}`, awb: order.awb, current_status: "DELIVERED" },
  });
  expect(res.ok()).toBe(true);
}

async function reviewRequest(request: APIRequestContext, orderId: string) {
  const res = await request.get(`${BACKEND}/admin/orders/${orderId}/review-request`, { headers: ADMIN });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { review_request: { completed_at: string | null; token_used_at: string | null; notifications: { stage: string; channel: string; status: string; detail: string | null }[] }; reviews: { id: string; status: string; rating: number }[] };
}

/** A fresh link through the admin route (the emailed one is never readable). */
async function linkFor(request: APIRequestContext, orderId: string): Promise<string> {
  const res = await request.post(`${BACKEND}/admin/orders/${orderId}/review-request/link`, { headers: ADMIN });
  expect(res.ok()).toBe(true);
  const { url } = (await res.json()) as { url: string };
  return new URL(url).pathname;
}

async function moderate(request: APIRequestContext, ids: string[], action: "approve" | "reject", extra: Record<string, string> = {}) {
  const res = await request.post(`${BACKEND}/admin/product-reviews/moderate`, { headers: ADMIN, data: { ids, action, ...extra } });
  expect(res.ok()).toBe(true);
}

async function writeReview(page: Page, rating: number, body: string, photo?: Buffer) {
  if (rating) await page.getByRole("radio", { name: new RegExp(`^${rating} stars?,`) }).click();
  await page.getByLabel("Your review", { exact: true }).fill(body);
  if (photo) {
    await page.getByLabel(/Add photos of/).setInputFiles({ name: "IMG_2041.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.getByAltText("Your photo")).toBeVisible();
    await expect(page.getByLabel("Uploading")).toHaveCount(0, { timeout: 20_000 });
  }
}

test.describe("product reviews", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  let ready = false;
  const created: string[] = [];

  test.beforeAll(async ({ request }) => {
    try {
      const health = await request.get(`${BACKEND}/health`, { timeout: 5000 });
      const routes = await request.get(`${BACKEND}/admin/product-reviews?limit=1`, { headers: ADMIN });
      const hook = await request.post(`${BACKEND}/webhooks/shiprocket/order-update`, { headers: { "x-api-key": HOOK_SECRET }, data: {} });
      ready = health.ok() && routes.ok() && hook.status() === 200 && existsSync(path.join(BACKEND_DIR, "src/scripts/dev-review-fixture.ts"));
    } catch {
      ready = false;
    }
  });

  test.beforeEach(() => {
    test.skip(!ready, "needs the review backend on :9000 with its webhook secret and fixture script");
  });

  test.afterAll(async ({ request }) => {
    // Take the test reviews back off the product so local data stays clean.
    if (created.length) {
      await request.post(`${BACKEND}/admin/product-reviews/moderate`, {
        headers: ADMIN,
        data: { ids: created, action: "reject", reason: "not_genuine", note: "Automated end-to-end test review." },
      });
    }
  });

  test("a product with no reviews shows no rating and says so", async ({ page }) => {
    await page.goto("/products/celestial-band-ring");
    await expect(page.getByRole("heading", { name: "Customer reviews" })).toBeVisible();
    await expect(page.getByText("No reviews yet")).toBeVisible();
    await expect(page.getByText(/\/5/)).toHaveCount(0);
  });

  test("a made-up link shows that it is not valid", async ({ page }) => {
    await page.goto(`/review/${"Q".repeat(43)}`);
    await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeVisible();
  });

  test("delivered, reviewed with a photo on a phone, approved, and shown on the product page", async ({ page, request }) => {
    const before = await (await request.get(`${BACKEND}/store/product-reviews?handle=${PRODUCT}`, { headers: { "x-publishable-api-key": localEnv("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY") } })).json();

    const order = makeOrder();
    await deliver(request, order);
    await deliver(request, order); // a repeat must not open a second request

    // The request went out at once by email; no WhatsApp without consent.
    let status = await reviewRequest(request, order.order_id);
    expect(status.review_request.notifications).toHaveLength(4);
    const byKey = Object.fromEntries(status.review_request.notifications.map((n) => [`${n.stage}:${n.channel}`, n]));
    expect(byKey["request:email"].status).not.toBe("pending");
    expect(byKey["request:whatsapp"]).toMatchObject({ status: "skipped", detail: "no_consent" });
    expect(byKey["reminder:email"].status).toBe("scheduled");

    await page.setViewportSize({ width: 390, height: 844 });
    const link = await linkFor(request, order.order_id);
    await page.goto(`${link}?r=4`);
    await expect(page.getByRole("heading", { name: "How is it, Asha?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Luna Anklet" })).toBeVisible();
    // The rating tapped in the email is already chosen.
    await expect(page.getByRole("radio", { name: /^4 stars,/ })).toHaveAttribute("aria-checked", "true");
    // Nothing on the page overflows a phone screen.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);

    const photo = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 200, g: 200, b: 205 } } }).jpeg().toBuffer();
    await writeReview(page, 4, `Lovely shine and the clasp feels secure. Wearing it daily (${RUN}).`, photo);
    await page.getByRole("textbox", { name: /^Title/ }).fill("Everyday favourite");
    await page.getByRole("button", { name: "Send review" }).click();
    await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible({ timeout: 20_000 });

    // Single use, and the reminder is called off.
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Thanks, we have your review" })).toBeVisible();
    status = await reviewRequest(request, order.order_id);
    expect(status.review_request.token_used_at).toBeTruthy();
    const reminders = Object.fromEntries(status.review_request.notifications.filter((n) => n.stage === "reminder").map((n) => [n.channel, n.status]));
    // The email reminder is called off; the WhatsApp one was never going (no consent).
    expect(reminders).toEqual({ email: "cancelled", whatsapp: "skipped" });
    expect(status.reviews).toHaveLength(1);
    expect(status.reviews[0]).toMatchObject({ status: "pending", rating: 4 });
    created.push(status.reviews[0].id);

    // Not shown until approved.
    await page.goto(`/products/${PRODUCT}`);
    await expect(page.getByText(`Wearing it daily (${RUN})`)).toHaveCount(0);

    await moderate(request, [status.reviews[0].id], "approve");
    await expect(async () => {
      await page.goto(`/products/${PRODUCT}`);
      await expect(page.getByText(`Wearing it daily (${RUN})`)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 70_000 });
    const section = page.locator("#reviews");
    await expect(section.getByText("Verified purchase").first()).toBeVisible();
    // With a photo on the page the reviews must still fit a phone: no sideways scroll.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
    await expect(section.getByRole("heading", { name: "Everyday favourite" })).toBeVisible();
    await expect(section.getByText(`Based on ${before.summary.count + 1} review`)).toBeVisible();
    // The customer's photo, and it opens large.
    await section.getByRole("listitem").filter({ hasText: `(${RUN})` }).getByRole("button", { name: /Open photo 1 from Asha R\./ }).click();
    await expect(page.getByRole("dialog", { name: "Customer photo" })).toBeVisible();
    await page.keyboard.press("Escape");
    // The header rating links to the section and counts only approved reviews.
    await expect(page.getByRole("link", { name: new RegExp(`\\(${before.summary.count + 1} reviews?\\)`) })).toBeVisible();
  });

  test("sorting puts the lowest or highest rating first", async ({ page, request }) => {
    const order = makeOrder();
    await deliver(request, order);
    await page.goto(await linkFor(request, order.order_id));
    await writeReview(page, 2, `Pretty, but the polish wore off within two weeks (${RUN}).`);
    await page.getByRole("button", { name: "Send review" }).click();
    await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible({ timeout: 20_000 });
    const status = await reviewRequest(request, order.order_id);
    created.push(status.reviews[0].id);
    // A negative review is published like any other.
    await moderate(request, [status.reviews[0].id], "approve");

    await expect(async () => {
      await page.goto(`/products/${PRODUCT}`);
      await expect(page.getByText(`within two weeks (${RUN})`)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 70_000 });
    const section = page.locator("#reviews");
    const first = section.locator("li p.whitespace-pre-line").first();
    await section.getByLabel("Sort by").selectOption("highest");
    await expect(first).not.toContainText("polish wore off");
    await section.getByLabel("Sort by").selectOption("lowest");
    await expect(first).toContainText("polish wore off");
    // A quick change of mind: the last choice wins, whatever order the answers come back in.
    await section.getByLabel("Sort by").selectOption("highest");
    await expect(first).not.toContainText("polish wore off");
  });

  test("the review form checks what is missing before sending", async ({ page, request }) => {
    const order = makeOrder();
    await deliver(request, order);
    await page.goto(await linkFor(request, order.order_id));
    await page.getByRole("button", { name: "Send review" }).click();
    await expect(page.locator("form [role=alert]")).toContainText("Choose a star rating");
    await page.getByRole("radio", { name: /^5 stars,/ }).click();
    await page.getByLabel("Your review", { exact: true }).fill("Nice");
    await page.getByRole("button", { name: "Send review" }).click();
    await expect(page.locator("form [role=alert]")).toContainText("at least 10 characters");
    // A file that is not an image is refused.
    await page.getByLabel(/Add photos of/).setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<svg onload=alert(1)>") });
    await expect(page.locator("form [role=alert]")).toContainText(/JPEG, PNG, WebP or HEIC/);
    await expect(page.getByAltText("Your photo")).toHaveCount(0);
  });
});

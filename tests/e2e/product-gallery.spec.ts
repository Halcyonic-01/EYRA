import { readFileSync } from "node:fs";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// The product image gallery: pagination dots instead of thumbnails and a counter, and
// no arrows on phones. Runs against the real Medusa backend; skipped when it is not running.

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

// A product with four images.
const PRODUCT = "/products/sovereign-signet-ring";

// The gallery card: the page's "Similar products" cards have arrows of their own.
const gallery = (page: Page) => page.getByRole("button", { name: "View image full screen" }).locator("xpath=..");
const arrow = (page: Page, name: "Previous image" | "Next image") => gallery(page).getByRole("button", { name });
const dots = (page: Page) => page.getByRole("group", { name: "Product images" }).getByRole("button");
// The gallery keeps every image mounted and shows one; the shown one is the one not aria-hidden.
const mainImage = (page: Page) => page.getByRole("button", { name: "View image full screen" }).locator('img:not([aria-hidden="true"])');
const activeSource = async (page: Page) => (await mainImage(page).getAttribute("src")) ?? "";

/** A real touch swipe across the main image, as a finger would make it. */
async function swipe(page: Page, direction: "left" | "right") {
  const box = (await page.getByRole("button", { name: "View image full screen" }).boundingBox())!;
  const y = box.y + box.height / 2;
  const from = box.x + box.width * (direction === "left" ? 0.8 : 0.2);
  const to = box.x + box.width * (direction === "left" ? 0.2 : 0.8);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: (from + to) / 2, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }).catch(() => undefined);
  await cdp.detach();
}

test.describe("product image gallery", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendReady(request)), "the Medusa backend is not running");
  });

  test("there are no thumbnails and no 1/4 counter; there is one dot for each image", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PRODUCT);
    await expect(dots(page)).toHaveCount(4);
    // The old thumbnails were labelled "View image 1"; the dots say "of 4".
    await expect(page.getByRole("button", { name: /^View image \d+$/ })).toHaveCount(0);
    await expect(page.getByText(/^1\/4$/)).toHaveCount(0);
  });

  test("the active dot is dark and larger than the others, and the dots sit centred under the image", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(PRODUCT);
    const sizes = await dots(page).evaluateAll((buttons) =>
      buttons.map((b) => {
        const dot = b.firstElementChild as HTMLElement;
        const r = dot.getBoundingClientRect();
        return { w: Math.round(r.width), active: b.getAttribute("aria-current") === "true", color: getComputedStyle(dot).backgroundColor };
      })
    );
    expect(sizes.filter((d) => d.active)).toHaveLength(1);
    // Smaller and subtler on phones: 8px active, 5px for the others.
    expect(sizes[0]).toMatchObject({ active: true, w: 8, color: "rgb(0, 0, 0)" });
    for (const other of sizes.slice(1)) expect(other.w).toBe(5);

    const group = (await page.getByRole("group", { name: "Product images" }).boundingBox())!;
    const image = (await page.getByRole("button", { name: "View image full screen" }).boundingBox())!;
    expect(Math.abs(group.x + group.width / 2 - (image.x + image.width / 2))).toBeLessThan(1);
    expect(group.y).toBeGreaterThan(image.y + image.height - 1);
  });

  test("on a phone there are no arrows, and a swipe moves the image and the active dot", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto(PRODUCT);
    await expect(arrow(page, "Previous image")).toBeHidden();
    await expect(arrow(page, "Next image")).toBeHidden();

    const first = await activeSource(page);
    await swipe(page, "left");
    await expect(dots(page).nth(1)).toHaveAttribute("aria-current", "true");
    expect(await activeSource(page)).not.toBe(first);
    await swipe(page, "left");
    await expect(dots(page).nth(2)).toHaveAttribute("aria-current", "true");
    await swipe(page, "right");
    await expect(dots(page).nth(1)).toHaveAttribute("aria-current", "true");
    await swipe(page, "right");
    await expect(dots(page).nth(0)).toHaveAttribute("aria-current", "true");
    expect(await activeSource(page)).toBe(first);
    // Swiping past either end stays put.
    await swipe(page, "right");
    await expect(dots(page).nth(0)).toHaveAttribute("aria-current", "true");
    await context.close();
  });

  test("on a desktop the arrows stay, and the arrows and the dots move the image together", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PRODUCT);
    await expect(arrow(page, "Previous image")).toBeVisible();
    await arrow(page, "Next image").click();
    await expect(dots(page).nth(1)).toHaveAttribute("aria-current", "true");
    await dots(page).nth(3).click();
    await expect(dots(page).nth(3)).toHaveAttribute("aria-current", "true");
    await expect(arrow(page, "Next image")).toBeDisabled();
    await arrow(page, "Previous image").click();
    await expect(dots(page).nth(2)).toHaveAttribute("aria-current", "true");
  });

  test("on a phone the image card is square and the share and wishlist buttons sit inside its top corner", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(PRODUCT);
    const card = (await gallery(page).boundingBox())!;
    expect(Math.abs(card.width - card.height)).toBeLessThan(2);
    const share = (await gallery(page).getByRole("button", { name: "Share" }).boundingBox())!;
    expect(share.x + share.width).toBeLessThanOrEqual(card.x + card.width);
    expect(share.y).toBeGreaterThanOrEqual(card.y);
    // The dots sit inside the card, near its bottom, centred.
    const group = (await page.getByRole("group", { name: "Product images" }).boundingBox())!;
    expect(group.y + group.height).toBeLessThanOrEqual(card.y + card.height);
    expect(Math.abs(group.x + group.width / 2 - (card.x + card.width / 2))).toBeLessThan(1);
  });

  test("from a tablet up the card keeps its taller shape", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PRODUCT);
    const card = (await gallery(page).boundingBox())!;
    expect(card.height).toBeGreaterThanOrEqual(436);
    expect(card.height).toBeGreaterThan(card.width * 0.8);
  });

  test("switching images is instant: the next image is already loaded before it is shown", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(PRODUCT);
    const area = page.getByRole("button", { name: "View image full screen" });
    // Every image sits in the gallery once; nothing is fetched again on a switch.
    await expect(area.locator("img")).toHaveCount(4);
    // The first image and its neighbour finish loading on their own.
    await expect.poll(() => area.locator("img").nth(1).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const requests: string[] = [];
    page.on("request", (r) => { if (r.url().includes("/_next/image")) requests.push(r.url()); });
    await dots(page).nth(1).click();
    // Shown at once, already decoded, with no new download for it.
    expect(await mainImage(page).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await dots(page).nth(0).click();
    expect(await mainImage(page).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(requests).toHaveLength(0);
  });

  test("the full-screen view switches instantly too, and keeps its own place in sync with the page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(PRODUCT);
    await page.getByRole("button", { name: "View image full screen" }).click();
    const view = page.getByRole("dialog", { name: /images$/ });
    await expect(view).toBeVisible();
    await expect(view.locator("img")).toHaveCount(4);
    const shown = () => view.locator('img:not([aria-hidden="true"])');
    // The open image and its neighbour load on their own.
    await expect.poll(() => view.locator("img").nth(1).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.keyboard.press("ArrowRight");
    await expect(view.getByText("2/4")).toBeVisible();
    expect(await shown().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(shown()).toHaveAttribute("alt", /view 2$/);
    // Each step loads the next neighbour ahead of time.
    await expect.poll(() => view.locator("img").nth(2).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.keyboard.press("ArrowRight");
    expect(await shown().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(view).toBeHidden();
    // The page gallery is on the same image.
    await expect(dots(page).nth(2)).toHaveAttribute("aria-current", "true");
  });
});


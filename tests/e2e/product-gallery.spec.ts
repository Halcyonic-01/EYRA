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
const mainImage = (page: Page) => page.getByRole("button", { name: "View image full screen" }).locator("img");
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
    expect(sizes[0]).toMatchObject({ active: true, w: 10, color: "rgb(0, 0, 0)" });
    for (const other of sizes.slice(1)) expect(other.w).toBe(6);

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

  test("the image area is the same size with or without the arrows, so the layout does not shift", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(PRODUCT);
    const area = page.getByRole("button", { name: "View image full screen" });
    const before = (await area.boundingBox())!;
    // Put the arrows back, as they were: nothing moves.
    await page.addStyleTag({ content: 'button[aria-label="Previous image"], button[aria-label="Next image"] { display: flex !important; }' });
    const after = (await area.boundingBox())!;
    expect(Math.round(after.height)).toBe(Math.round(before.height));
    expect(Math.round(after.width)).toBe(Math.round(before.width));
  });
});

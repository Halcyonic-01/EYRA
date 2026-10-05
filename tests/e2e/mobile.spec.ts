import { test, expect } from "@playwright/test";

// A plain viewport override rather than devices["iPhone SE"]: that preset
// pins browserName to webkit, and also sets isMobile: true, which Chromium's
// mobile emulation resolves to a layout viewport wider than the requested
// one (462px was observed for a 375px request), silently invalidating any
// overflow check run under it. A bare viewport keeps window.innerWidth
// exactly what's requested.
test.use({ viewport: { width: 375, height: 812 } });

test.describe("mobile viewport", () => {
  test("no page has horizontal overflow", async ({ page }) => {
    for (const path of ["/", "/products", "/products/celestial-band-ring", "/cart", "/wishlist", "/sign-up", "/sign-in"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const { innerWidth, scrollWidth } = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(scrollWidth, `${path}: scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`).toBeLessThanOrEqual(innerWidth + 2);
    }
  });

  test("cart with an item does not overflow and shows quantity controls", async ({ page }) => {
    // Regression test: the item row's checkbox+image+qty-stepper+remove
    // button, sized for a desktop-width row, didn't fit beside the info
    // column at a 375px viewport and pushed the page 87px wider than the
    // screen, silently cutting off the quantity controls at the edge.
    await page.goto("/products");
    await page.getByRole("button", { name: "Type" }).click();
    await page.getByRole("menu").getByText("Chains", { exact: true }).click();
    await page.locator("article").first().getByRole("button", { name: "Add to cart" }).click();
    await page.waitForTimeout(300);

    await page.goto("/cart");
    await expect(page.getByRole("button", { name: "Increase quantity" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove item" })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 2);
  });

  test("products filter dropdown panel is actually visible and usable, not clipped", async ({ page }) => {
    // Regression test: the filter bar's overflow-x-auto (needed so the row
    // of pills can scroll on narrow screens) also clipped the dropdown
    // panel vertically, since CSS makes overflow-x: auto imply a
    // non-visible overflow-y too. The panel was in the DOM with the right
    // z-index and reported as "visible" by accessibility queries, but a
    // real point-based hit test landed on the product grid underneath it.
    await page.goto("/products");
    await page.getByRole("button", { name: "Type" }).click();

    const ringsOption = page.getByRole("menu").getByText("Rings", { exact: true });
    await expect(ringsOption).toBeVisible();

    const box = await ringsOption.boundingBox();
    expect(box).not.toBeNull();
    const elementAtPoint = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.getAttribute("role") ?? document.elementFromPoint(x, y)?.tagName,
      [box!.x + box!.width / 2, box!.y + box!.height / 2] as const
    );
    // The checkbox row (or something inside role="menu") should be the
    // actual top-most element at that point, not a product card underneath.
    expect(elementAtPoint).not.toBe("ARTICLE");

    await ringsOption.click();
    await page.waitForTimeout(300);
    const titles = await page.locator("article h3").allInnerTexts();
    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) {
      expect(title.toLowerCase()).not.toContain("chain");
    }
  });

  test("ring product card sends to PDP instead of a sizeless add", async ({ page }) => {
    await page.goto("/products");
    await page.getByRole("button", { name: "Type" }).click();
    await page.getByRole("menu").getByText("Rings", { exact: true }).click();

    const firstCard = page.locator("article").first();
    await expect(firstCard.getByRole("button", { name: "Select size" })).toBeVisible();
    await firstCard.getByRole("button", { name: "Select size" }).click();
    await expect(page).toHaveURL(/\/products\/[^/]+$/);
  });

  test("filter pills stay single-line and the row scrolls instead of wrapping, even with every pill active", async ({ page }) => {
    // Regression test: the Dropdown trigger button had no shrink-0, so once
    // "Clear all" joined the row (any filter or search active) there wasn't
    // room left for every pill at its natural width. Flex's default
    // flex-shrink: 1 let "Sort by" shrink below its label's width instead of
    // the already-overflow-x-auto row simply extending and scrolling, and
    // the label wrapped to two lines, taller than the pills beside it.
    await page.goto("/products");
    await page.getByRole("button", { name: "Type" }).click();
    await page.getByRole("menu").getByText("Rings", { exact: true }).click();
    await page.getByRole("menu").getByText("Chains", { exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Price" }).click();
    await page.getByRole("menu").getByText("Under", { exact: false }).click();
    await page.waitForTimeout(200);

    const sortPill = page.getByRole("button", { name: /^Sort by$/ });
    await expect(sortPill).toBeVisible();
    const box = await sortPill.boundingBox();
    // A single-line pill at this font/padding is ~43px tall (py-2.5 + one
    // 21px line); a wrapped "Sort / by" pill measured ~64px, two lines plus
    // the same padding. 55 cleanly separates the two.
    expect(box!.height).toBeLessThan(55);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375 + 2);
  });

  test("homepage delivery-check panel stays within the viewport regardless of panel width", async ({ page }) => {
    // Regression test: Dropdown's edge clamp hardcoded PANEL_WIDTH = 240,
    // correct for the filter bar's checkbox lists but not for this widget's
    // wider (260px) form. The clamp under-corrected by the difference and
    // let the panel run off the right edge, invisible past the viewport
    // even though it caused no page-level scroll (position: fixed content
    // doesn't affect document.scrollWidth), so that check alone would not
    // have caught it.
    await page.goto("/");
    await page.getByRole("button", { name: "Check Delivery" }).click();
    await page.waitForTimeout(300);

    const panel = page.getByRole("menu");
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);

    // The panel grows taller once a result renders; the fix must hold then too.
    await page.getByPlaceholder("6-digit pincode").fill("110001");
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await page.waitForResponse((r) => r.url().includes("/api/shipping/serviceability"));
    await page.waitForTimeout(300);
    const boxAfter = await panel.boundingBox();
    expect(boxAfter!.x).toBeGreaterThanOrEqual(0);
    expect(boxAfter!.x + boxAfter!.width).toBeLessThanOrEqual(375);
  });
});

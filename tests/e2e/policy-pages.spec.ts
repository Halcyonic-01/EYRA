import { test, expect, type Page } from "@playwright/test";

// The policy pages have to match how orders really work, so these check the
// promises that matter most. The cancel window is a setting, so the
// cancellation text is only checked when the page shows it.

const ORDERS_EMAIL = "query-orders@eyra.org.in";

async function pageText(page: Page, path: string): Promise<string> {
  await page.goto(path);
  return page.locator("body").innerText();
}

test.describe("policy pages", () => {
  test("returns are settled as wallet credit, not promised as a bank refund", async ({ page }) => {
    const text = await pageText(page, "/refund-policy");
    expect(text).toContain("added to your EYRA wallet as store credit");
    expect(text).not.toContain("original payment source");
    expect(text).not.toContain("Replacement dispatch begins");
  });

  test("section references point at sections that exist", async ({ page }) => {
    const text = await pageText(page, "/refund-policy");
    const refs = [...text.matchAll(/section (\d+)/g)].map((match) => match[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const n of refs) {
      expect(text).toMatch(new RegExp(`^${n}\\. `, "m"));
    }
  });

  test("the cancellation section states the fee and the cut-off", async ({ page }) => {
    const text = await pageText(page, "/refund-policy");
    test.skip(!text.includes("Cancelling an order before it ships"), "cancelling is switched off");
    expect(text).toContain("cancellation fee");
    expect(text).toContain("can no longer be cancelled");
    expect(text).toContain("only the wallet option is offered");
  });

  test("the shipping policy says when the tax invoice is issued", async ({ page }) => {
    const text = await pageText(page, "/shipping-policy");
    expect(text).toContain("GST tax invoice when your order is dispatched");
  });

  for (const path of ["/refund-policy", "/shipping-policy", "/terms-of-service", "/grievance-redressal"]) {
    test(`${path} sends order questions to the orders mailbox`, async ({ page }) => {
      const text = await pageText(page, path);
      expect(text).toContain(ORDERS_EMAIL);
    });
  }
});

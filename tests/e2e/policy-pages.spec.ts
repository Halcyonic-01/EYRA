import { test, expect, type Page } from "@playwright/test";

// The policy pages have to match how orders really work, so these check the
// promises that matter most. The cancel window is a setting, so the
// cancellation text is only checked when the page shows it.

const ORDERS_EMAIL = "query-orders@eyra.org.in";
const GRIEVANCE_EMAIL = "grievance@eyra.org.in";

async function pageText(page: Page, path: string): Promise<string> {
  await page.goto(path);
  return page.locator("body").innerText();
}

test.describe("policy pages", () => {
  test("returns are settled as store credit, not promised as a bank refund", async ({ page }) => {
    const text = await pageText(page, "/refund-policy");
    expect(text).toContain("we add store credit to your EYRA wallet");
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

  test("the cancellation section promises a full refund before dispatch and says what to do after", async ({ page }) => {
    const text = await pageText(page, "/refund-policy");
    test.skip(!text.includes("Cancelling an order, and orders already on their way"), "cancelling is switched off");
    expect(text).toContain("100% refundable");
    expect(text).toContain("can no longer be cancelled");
    expect(text).toContain("refuse the delivery");
    // The cancellation fee and the wallet choice are gone.
    expect(text).not.toContain("cancellation fee");
    expect(text).not.toContain("only the wallet option is offered");
  });

  test("the shipping policy says when the tax invoice is issued", async ({ page }) => {
    const text = await pageText(page, "/shipping-policy");
    expect(text).toContain("GST tax invoice when your order is dispatched");
  });

  for (const path of ["/grievance-redressal", "/privacy-policy", "/terms-of-service"]) {
    test(`${path} names the grievance mailbox`, async ({ page }) => {
      const text = await pageText(page, path);
      expect(text).toContain(GRIEVANCE_EMAIL);
    });
  }

  for (const path of ["/refund-policy", "/shipping-policy", "/terms-of-service", "/grievance-redressal"]) {
    test(`${path} sends order questions to the orders mailbox`, async ({ page }) => {
      const text = await pageText(page, path);
      expect(text).toContain(ORDERS_EMAIL);
    });
  }
});

test.describe("the return and exchange windows", () => {
  test("every policy page says 15 days for a return and 7 days for an exchange", async ({ page }) => {
    const refund = await pageText(page, "/refund-policy");
    expect(refund).toContain("Returns within 15 days, exchanges within 7 days");
    expect(refund).toContain("returned within 15 days of delivery and exchanged within 7 days of delivery");
    const terms = await pageText(page, "/terms-of-service");
    expect(terms).toContain("Returns are accepted within 15 days of delivery and exchanges within 7 days");
  });

  test("the product page badges say 15 Days Return and 7 Days Exchange", async ({ page }) => {
    await page.goto("/products/luna-anklet");
    const body = page.locator("main");
    await expect(body).toContainText("15 Days Return");
    await expect(body).toContainText("7 Days Exchange");
    await expect(page.getByTestId("policy-badge")).toHaveText("Free 7-Day Easy Exchanges & 15-Day Store Credit Returns. No Cash Refunds.");
  });
});

test.describe("no postage reimbursement promise", () => {
  test("the refund policy no longer offers to reimburse return postage", async ({ page }) => {
    const text = await pageText(page, "/refund-policy");
    expect(text).not.toMatch(/reimburs|Speed Post|₹\s?70\b/i);
    expect(text).toContain("If a pickup cannot be arranged from your PIN code");
  });
});

test.describe("every policy agrees on the return, exchange and cancellation rules", () => {
  test("the terms of service state them", async ({ page }) => {
    const text = await pageText(page, "/terms-of-service");
    expect(text).toContain("store credit, not cash");
    expect(text).toContain("flat ₹99 reverse logistics fee");
    expect(text).toContain("no fee for a damaged or defective item");
    expect(text).toContain("Exchanges for another size or design have no fee");
    expect(text).toContain("100% refundable");
    expect(text).toContain("GST credit note");
    expect(text).toContain("Cash on Delivery charge includes 18% GST");
    expect(text).toContain("within 15 days of delivery and exchanges within 7 days");
  });

  test("the shipping policy covers the COD GST, credit notes, and a refused delivery", async ({ page }) => {
    const text = await pageText(page, "/shipping-policy");
    expect(text).toContain("includes 18% GST");
    expect(text).toContain("GST credit note");
    expect(text).toContain("refuse a delivery");
    expect(text).toContain("less a ₹99 reverse logistics fee");
  });

  test("the privacy policy names the messaging providers and credit note records", async ({ page }) => {
    const text = await pageText(page, "/privacy-policy");
    expect(text).toContain("AiSensy and WATI");
    expect(text).toContain("tax invoices and credit notes");
  });

  test("no page still talks of a cancellation fee, a wallet refund choice, a 7-day return or an exchange handling fee", async ({ page }) => {
    for (const path of ["/refund-policy", "/terms-of-service", "/shipping-policy", "/support", "/authenticity-and-care", "/contact"]) {
      const text = await pageText(page, path);
      expect(text, path).not.toMatch(/cancellation fee/i);
      expect(text, path).not.toMatch(/7[- ]day returns?\b/i);
      expect(text, path).not.toMatch(/handling fee/i);
      expect(text, path).not.toContain("only the wallet option is offered");
    }
  });
});

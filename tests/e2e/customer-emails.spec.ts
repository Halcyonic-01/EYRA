import { test, expect } from "@playwright/test";
import { LOGO_CID, isOwnSiteUrl } from "../../lib/email-layout";
import {
  renderOrderDelivered,
  renderOrderShipped,
  renderPromotion,
  renderRefundProcessed,
  renderWelcomeOffer,
} from "../../lib/customer-email-templates";
import { signUnsubscribe, unsubscribeUrl, verifyUnsubscribe } from "../../lib/unsubscribe-token";

// What customers read, and the guards around offers.

const SECRET = { EMAIL_UNSUBSCRIBE_SECRET: "test-secret-for-unsubscribe-links" };

test.describe("the logo", () => {
  test("every email shows the real EYRA logo image, not typed text", () => {
    const u = "https://www.eyra.org.in/api/newsletter/unsubscribe?e=a%40b.com&t=abc";
    const emails = [
      renderOrderShipped({ orderNumber: 1, orderId: "o", awb: null, courier: null }),
      renderOrderDelivered({ orderNumber: 1, orderId: "o" }),
      renderRefundProcessed({ orderNumber: 1, amount: 1, reason: "r", creditNote: null, eta: "e" }),
      renderWelcomeOffer({ code: "WELCOME200", amount: 200, minOrder: 1499, unsubscribeUrl: u }),
      renderPromotion({ subject: "s", headline: "h", message: "m", ctaLabel: "c", ctaUrl: "https://www.eyra.org.in/", unsubscribeUrl: u }),
    ];
    for (const { html } of emails) {
      expect(html).toContain(`<img src="cid:${LOGO_CID}"`);
      expect(html).toContain('alt="EYRA"');
      expect(html).not.toContain("Cormorant");
    }
  });

  test("the logo is an attachment of the email itself, not a link that must be hosted", () => {
    expect(LOGO_CID).toBe("eyra-logo");
  });
});

test.describe("order update emails", () => {
  test("shipped names the order, courier and tracking number, and links to the order", () => {
    const { subject, html } = renderOrderShipped({
      firstName: "Asha",
      orderNumber: 342,
      orderId: "order_01ABC",
      awb: "1234567890",
      courier: "Delhivery",
    });
    expect(subject).toBe("Your EYRA order #342 is on its way");
    expect(html).toContain("Hi Asha,");
    expect(html).toContain("Delhivery");
    expect(html).toContain("1234567890");
    expect(html).toContain("https://www.eyra.org.in/orders/order_01ABC");
    expect(html).toContain("EYRA");
  });

  test("shipped leaves out the courier and tracking rows when they are not known yet", () => {
    const { html } = renderOrderShipped({ orderNumber: 342, orderId: "order_01ABC", awb: null, courier: null });
    expect(html).toContain("Hello,");
    expect(html).not.toContain("Tracking number");
    expect(html).not.toContain("Courier");
  });

  test("delivered quotes the return and exchange windows the site promises", () => {
    const { subject, html } = renderOrderDelivered({ firstName: "Asha", orderNumber: 342, orderId: "order_01ABC" });
    expect(subject).toBe("Your EYRA order #342 has been delivered");
    expect(html).toContain("within 15 days");
    expect(html).toContain("within 7 days");
  });

  test("refund shows the amount, the wait and the credit note", () => {
    const { subject, html } = renderRefundProcessed({
      firstName: "Asha",
      orderNumber: 342,
      amount: 1901,
      reason: "your parcel was returned to us",
      creditNote: "CN/26-27/0007",
      eta: "5 to 7 working days",
    });
    expect(subject).toBe("Your refund of ₹1,901 for order #342");
    expect(html).toContain("₹1,901");
    expect(html).toContain("5 to 7 working days");
    expect(html).toContain("CN/26-27/0007");
    expect(html).toContain("because your parcel was returned to us");
  });

  test("a customer's name or any other text cannot inject markup", () => {
    const { html } = renderOrderShipped({
      firstName: '<img src=x onerror="alert(1)">',
      orderNumber: 1,
      orderId: "order_1",
      awb: "<script>alert(2)</script>",
      courier: "Evil & Co",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Evil &amp; Co");
  });
});

test.describe("offer emails", () => {
  const unsubscribe = "https://www.eyra.org.in/api/newsletter/unsubscribe?e=a%40b.com&t=abc";

  test("the welcome offer shows the code, the saving, the minimum, and how to unsubscribe", () => {
    const { subject, html } = renderWelcomeOffer({
      firstName: "Asha",
      code: "WELCOME200",
      amount: 200,
      minOrder: 1499,
      unsubscribeUrl: unsubscribe,
    });
    expect(subject).toBe("Welcome to EYRA: ₹200 off your first order");
    expect(html).toContain("WELCOME200");
    expect(html).toContain("₹200 off orders above ₹1,499");
    expect(html).toContain("once per account");
    // Inside an HTML attribute the & of the query string is written &amp;.
    expect(html).toContain(`href="${unsubscribe.replace(/&/g, "&amp;")}"`);
    expect(html).toContain("Unsubscribe");
  });

  test("a promotion carries its offer and an unsubscribe link, and an offer-less one still has the link", () => {
    const withOffer = renderPromotion({
      subject: "Diwali offer",
      headline: "A little sparkle",
      message: "Our festive pieces are in.",
      offer: { code: "EYRA350", amount: 350, minOrder: 3000 },
      ctaLabel: "Shop the collection",
      ctaUrl: "https://www.eyra.org.in/products",
      unsubscribeUrl: unsubscribe,
    });
    expect(withOffer.subject).toBe("Diwali offer");
    expect(withOffer.html).toContain("EYRA350");
    expect(withOffer.html).toContain("₹350 off orders above ₹3,000");
    expect(withOffer.html).toContain('href="https://www.eyra.org.in/products"');
    expect(withOffer.html).toContain("Unsubscribe");

    const without = renderPromotion({
      subject: "New arrivals",
      headline: "New in",
      message: "Fresh designs.",
      ctaLabel: "See what is new",
      ctaUrl: "https://www.eyra.org.in/new-arrivals",
      unsubscribeUrl: unsubscribe,
    });
    expect(without.html).not.toContain("YOUR CODE");
    expect(without.html).toContain("Unsubscribe");
  });

  test("campaign text is escaped", () => {
    const { html } = renderPromotion({
      subject: "s",
      headline: "<b>Big</b>",
      message: '"><script>x()</script>',
      ctaLabel: "Go",
      ctaUrl: "https://www.eyra.org.in/",
      unsubscribeUrl: unsubscribe,
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Big</b>");
  });
});

test.describe("unsubscribe links", () => {
  test("a link verifies for its own address, whatever the case or spacing", () => {
    const token = signUnsubscribe("Asha@Example.com ", SECRET);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyUnsubscribe("asha@example.com", token!, SECRET)).toBe(true);
  });

  test("a link made for one address does not work for another, or with a different secret", () => {
    const token = signUnsubscribe("asha@example.com", SECRET)!;
    expect(verifyUnsubscribe("someone-else@example.com", token, SECRET)).toBe(false);
    expect(verifyUnsubscribe("asha@example.com", token, { EMAIL_UNSUBSCRIBE_SECRET: "another-secret" })).toBe(false);
    expect(verifyUnsubscribe("asha@example.com", "", SECRET)).toBe(false);
    expect(verifyUnsubscribe("asha@example.com", token.slice(0, -1), SECRET)).toBe(false);
  });

  test("with no secret there is no link, and nothing verifies", () => {
    expect(signUnsubscribe("asha@example.com", {})).toBeNull();
    expect(unsubscribeUrl("asha@example.com", {})).toBeNull();
    expect(verifyUnsubscribe("asha@example.com", "anything", {})).toBe(false);
  });

  test("the shared revalidate secret is used when no dedicated one is set", () => {
    const env = { STOREFRONT_REVALIDATE_SECRET: "shared-secret-value" };
    const url = unsubscribeUrl("asha@example.com", env)!;
    const token = new URL(url).searchParams.get("t")!;
    expect(verifyUnsubscribe("asha@example.com", token, env)).toBe(true);
  });

  test("the link points at the unsubscribe page with the address and token", () => {
    const url = new URL(unsubscribeUrl("asha+test@example.com", SECRET)!);
    expect(url.origin + url.pathname).toBe("https://www.eyra.org.in/api/newsletter/unsubscribe");
    expect(url.searchParams.get("e")).toBe("asha+test@example.com");
    expect(url.searchParams.get("t")).toBeTruthy();
  });
});

test.describe("offer links", () => {
  test("lead only to the EYRA site", () => {
    expect(isOwnSiteUrl("https://www.eyra.org.in/products")).toBe(true);
    expect(isOwnSiteUrl("https://eyra.org.in/new-arrivals?x=1")).toBe(true);
  });

  test("never to anywhere else, however it is dressed up", () => {
    for (const bad of [
      "https://evil.example/",
      "http://www.eyra.org.in/products",
      "https://www.eyra.org.in.evil.example/",
      "https://evil.example/https://www.eyra.org.in/",
      "https://www.eyra.org.in@evil.example/",
      "https://user:pw@www.eyra.org.in/",
      "javascript:alert(1)",
      "//evil.example",
      "/products",
      "",
    ]) {
      expect(isOwnSiteUrl(bad), bad).toBe(false);
    }
  });
});

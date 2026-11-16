import { test, expect } from "@playwright/test";
import { ratedLink, renderReviewReminder, renderReviewRequest } from "../../lib/customer-email-templates";
import { reviewLinkAllowed, wellFormedReviewToken } from "../../lib/review-links";
import { sniffPhoto } from "../../lib/review-photo-check";
import { buildAisensyRequest, providerFrom, templateName, templateValues } from "../../lib/whatsapp";

// The review request messages and the checks around them. Pure logic: no server.

const TOKEN = "A".repeat(20) + "b_-" + "9".repeat(20);
const URL_LIVE = `https://www.eyra.org.in/review/${TOKEN}`;

test.describe("review links", () => {
  test("are 43 url-safe characters", () => {
    expect(wellFormedReviewToken(TOKEN)).toBe(true);
    for (const bad of ["", "short", TOKEN + "x", TOKEN.slice(1) + "!", 42]) expect(wellFormedReviewToken(bad)).toBe(false);
  });

  test("in an email must point at our own review page", () => {
    expect(reviewLinkAllowed(URL_LIVE, { NODE_ENV: "production" })).toBe(true);
    expect(reviewLinkAllowed(`https://eyra.org.in/review/${TOKEN}`, { NODE_ENV: "production" })).toBe(true);
    expect(reviewLinkAllowed(`https://evil.example/review/${TOKEN}`, { NODE_ENV: "production" })).toBe(false);
    expect(reviewLinkAllowed(`http://www.eyra.org.in/review/${TOKEN}`, { NODE_ENV: "production" })).toBe(false);
    expect(reviewLinkAllowed(`https://www.eyra.org.in/account/${TOKEN}`, { NODE_ENV: "production" })).toBe(false);
    expect(reviewLinkAllowed(`https://user:pw@www.eyra.org.in/review/${TOKEN}`, { NODE_ENV: "production" })).toBe(false);
    // The local storefront only outside production.
    expect(reviewLinkAllowed(`http://localhost:3000/review/${TOKEN}`, { NODE_ENV: "development" })).toBe(true);
    expect(reviewLinkAllowed(`http://localhost:3000/review/${TOKEN}`, { NODE_ENV: "production" })).toBe(false);
  });
});

test.describe("review request emails", () => {
  const params = {
    firstName: "Asha",
    orderNumber: 1042,
    reviewUrl: URL_LIVE,
    products: [
      { title: "Luna Anklet", variant: "Pair", thumbnail: "https://cdn.example/luna.webp" },
      { title: "<script>alert(1)</script>", variant: null, thumbnail: "http://insecure.example/x.jpg" },
    ],
  };

  test("carry the customer's link, the products and a star row that pre-fills the rating", () => {
    const { subject, html } = renderReviewRequest(params);
    expect(subject).toBe("How are you finding your Luna Anklet?");
    expect(html).toContain(URL_LIVE);
    expect(html).toContain("Hi Asha,");
    expect(html).toContain("#1042");
    for (const n of [1, 2, 3, 4, 5]) expect(html).toContain(ratedLink(URL_LIVE, n).replace(/&/g, "&amp;"));
    expect(ratedLink(URL_LIVE, 4)).toBe(`${URL_LIVE}?r=4`);
    expect(html).toContain("https://cdn.example/luna.webp");
  });

  test("escape what came from outside and show only secure images", () => {
    const { html } = renderReviewRequest(params);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("http://insecure.example/x.jpg");
  });

  test("the reminder says it is the only one, and uses the same link", () => {
    const { subject, html } = renderReviewReminder(params);
    expect(subject).toContain("review your Luna Anklet");
    expect(html).toContain(URL_LIVE);
    expect(html).toContain("only reminder");
  });
});

test.describe("review request WhatsApp", () => {
  test("uses AiSensy by default when its key is set, and nothing without a provider", () => {
    expect(providerFrom({})).toBeNull();
    expect(providerFrom({ AISENSY_API_KEY: "key" })).toBe("aisensy");
    expect(providerFrom({ WHATSAPP_PROVIDER: "wati", AISENSY_API_KEY: "key" })).toBeNull();
    expect(providerFrom({ WHATSAPP_PROVIDER: "wati", WATI_API_URL: "https://x", WATI_ACCESS_TOKEN: "t" })).toBe("wati");
  });

  test("fills name, product and link in the template's order", () => {
    const message = { template: "review_request" as const, phone: "919876543210", name: "Asha", params: { product: "Luna Anklet", link: URL_LIVE, order: 1042 } };
    expect(templateValues(message)).toEqual(["Asha", "Luna Anklet", URL_LIVE]);
    expect(templateName("review_request", {})).toBe("eyra_review_request");
    expect(templateName("review_reminder", { WHATSAPP_TEMPLATE_REVIEW_REMINDER: "my_reminder" })).toBe("my_reminder");
    const body = JSON.parse(buildAisensyRequest(message, { AISENSY_API_KEY: "key" }).init.body);
    expect(body).toMatchObject({ campaignName: "eyra_review_request", destination: "919876543210", templateParams: ["Asha", "Luna Anklet", URL_LIVE] });
  });
});

test.describe("review photos", () => {
  test("are recognised by their bytes, not their name", () => {
    expect(sniffPhoto(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffPhoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(sniffPhoto(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(sniffPhoto(new TextEncoder().encode("\0\0\0\x18ftypheic"))).toBe("heic");
    expect(sniffPhoto(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffPhoto(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffPhoto(new Uint8Array([]))).toBeNull();
  });
});

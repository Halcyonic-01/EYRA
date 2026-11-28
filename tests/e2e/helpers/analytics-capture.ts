import { gunzipSync } from "node:zlib";
import type { Page } from "@playwright/test";

import { CONSENT_COOKIE } from "../../../lib/analytics/consent";

/**
 * Catches everything the browser sends to the analytics proxy (/ev), so
 * nothing reaches PostHog, and lets a test set the analytics choice.
 */

export type Captured = { event: string; properties: Record<string, unknown>; $set?: Record<string, unknown> };

function decode(body: Buffer | null): Captured[] {
  if (!body?.length) return [];
  let text: string;
  try {
    text = gunzipSync(body).toString("utf8");
  } catch {
    text = body.toString("utf8");
    const data = new URLSearchParams(text).get("data");
    if (data) text = Buffer.from(data, "base64").toString("utf8");
  }
  try {
    const parsed = JSON.parse(text) as Captured | Captured[] | { batch?: Captured[] };
    if (Array.isArray(parsed)) return parsed;
    if ("batch" in parsed && Array.isArray(parsed.batch)) return parsed.batch;
    return "event" in parsed ? [parsed as Captured] : [];
  } catch {
    return [];
  }
}

export async function catchAnalytics(page: Page): Promise<Captured[]> {
  const events: Captured[] = [];
  // posthog-js drops events from automated browsers (navigator.webdriver, headless
  // user agents): right in production, so the test presents as an ordinary browser.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    const brands = [{ brand: "Chromium", version: "140" }, { brand: "Google Chrome", version: "140" }];
    Object.defineProperty(navigator, "userAgentData", { get: () => ({ brands, mobile: false, platform: "Windows", getHighEntropyValues: async () => ({ brands }) }) });
  });
  await page.route("**/ev/**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") events.push(...decode(request.postDataBuffer()));
    const url = request.url();
    if (url.includes("/flags") || url.includes("/decide")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    if (url.endsWith(".js")) return route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
    return route.fulfill({ status: 200, contentType: "application/json", body: '{"status":1}' });
  });
  return events;
}

export const named = (events: Captured[], name: string) => events.filter((e) => e.event === name);

/** The analytics choice as the banner stores it: set before the page loads. */
export async function setConsentCookie(page: Page, status: "granted" | "denied", baseURL: string) {
  const value = encodeURIComponent(`${status}.1.${new Date().toISOString()}`);
  await page.context().addCookies([{ name: CONSENT_COOKIE, value, url: baseURL }]);
}

/** Every request to the analytics proxy, whatever its method. */
export function watchAnalyticsRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/ev")) urls.push(request.url());
  });
  return urls;
}

/** Cookies and storage keys PostHog writes. */
export async function posthogTraces(page: Page): Promise<{ cookies: string[]; storage: string[]; loaded: boolean }> {
  const cookies = (await page.context().cookies()).map((c) => c.name).filter((n) => n.startsWith("ph_") || n.startsWith("__ph"));
  const { storage, loaded } = await page.evaluate(() => ({
    storage: [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) => k.startsWith("ph_") || k.startsWith("__ph")),
    loaded: "__PosthogExtensions__" in window,
  }));
  return { cookies, storage, loaded };
}

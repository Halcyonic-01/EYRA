import { test, expect } from "@playwright/test";
import type { CaptureResult } from "posthog-js";

import { analyticsConfig, analyticsRewrites, ANALYTICS_PATH } from "../../lib/analytics/config";
import { analyticsAllowed, CONSENT_COOKIE, CONSENT_VERSION, consentFromCookieHeader, encodeConsent, isPosthogStorageKey, parseConsent } from "../../lib/analytics/consent";
import { methodName } from "../../lib/analytics/events";
import { beforeSend, cleanPath, cleanUrl, recordingAllowed } from "../../lib/analytics/privacy";
import { trailingSlashRedirect } from "../../lib/trailing-slash";

// The analytics layer's rules: when it is on, what leaves the browser, and
// which pages are never recorded. Pure logic: no server.

const KEY = "phc_abcdefghijklmnopqrstu";

test.describe("configuration", () => {
  test("off without a project token; a personal (secret) key or unknown host is refused", () => {
    expect(analyticsConfig({})).toBeNull();
    expect(analyticsConfig({ NEXT_PUBLIC_POSTHOG_KEY: "phx_secretpersonalkey123" })).toBeNull();
    expect(analyticsConfig({ NEXT_PUBLIC_POSTHOG_KEY: KEY, NEXT_PUBLIC_POSTHOG_HOST: "https://evil.example.com" })).toBeNull();
  });

  test("EU by default, US when asked; replay only when switched on", () => {
    expect(analyticsConfig({ NEXT_PUBLIC_POSTHOG_KEY: KEY })).toMatchObject({
      region: "eu",
      ingestHost: "https://eu.i.posthog.com",
      assetsHost: "https://eu-assets.i.posthog.com",
      uiHost: "https://eu.posthog.com",
      replay: false,
    });
    expect(analyticsConfig({ NEXT_PUBLIC_POSTHOG_KEY: KEY, NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com/", NEXT_PUBLIC_POSTHOG_REPLAY: "true" })).toMatchObject({
      region: "us",
      replay: true,
    });
  });

  test("the proxy rewrites are absent when off, and put the asset rules first", () => {
    expect(analyticsRewrites(null)).toEqual([]);
    const rules = analyticsRewrites(analyticsConfig({ NEXT_PUBLIC_POSTHOG_KEY: KEY }));
    expect(rules.map((r) => r.source)).toEqual([`${ANALYTICS_PATH}/static/:path*`, `${ANALYTICS_PATH}/array/:path*`, `${ANALYTICS_PATH}/:path*`]);
    expect(rules[2].destination).toBe("https://eu.i.posthog.com/:path*");
  });
});

test.describe("what leaves the browser", () => {
  test("review links lose their private token; query strings keep campaign tags only", () => {
    expect(cleanPath("/review/AbC_123-xyz")).toBe("/review/[token]");
    expect(cleanPath("/products/luna-anklet")).toBe("/products/luna-anklet");
    expect(cleanUrl("https://www.eyra.org.in/review/SECRETTOKEN?utm_source=email#x")).toBe("https://www.eyra.org.in/review/[token]?utm_source=email");
    expect(cleanUrl("https://www.eyra.org.in/orders/success?orderId=order_1&payment_id=pay_1&utm_campaign=sale")).toBe(
      "https://www.eyra.org.in/orders/success?utm_campaign=sale"
    );
    expect(cleanUrl("not a url")).toBeNull();
  });

  test("before_send cleans every URL property and drops anything named like personal data", () => {
    const event = {
      uuid: "u",
      event: "$pageview",
      properties: {
        $current_url: "https://www.eyra.org.in/review/SECRET?email=a@b.com",
        $pathname: "/review/SECRET",
        $referrer: "https://www.eyra.org.in/orders/success?orderId=order_1",
        email: "a@b.com",
        customer_phone: "9999999999",
        product_id: "prod_1",
        $browser: "Chrome",
        token: "phc_projectkey",
        distinct_id: "cus_1",
      },
      $set: { name: "Asha", $os: "Mac OS X" },
    } as unknown as CaptureResult;
    const out = beforeSend(event)!;
    expect(out.properties).toEqual({
      $current_url: "https://www.eyra.org.in/review/[token]",
      $pathname: "/review/[token]",
      $referrer: "https://www.eyra.org.in/orders/success",
      product_id: "prod_1",
      $browser: "Chrome",
      // PostHog's own keys survive: without the token every event is dropped.
      token: "phc_projectkey",
      distinct_id: "cus_1",
    });
    expect(out.$set).toEqual({ $os: "Mac OS X" });
    expect(beforeSend(null)).toBeNull();
  });

  test("session replay never runs on account, order, wallet, sign-in, review or support pages", () => {
    for (const path of ["/account", "/orders", "/orders/order_1", "/wallet", "/sign-in/factor-one", "/sign-up", "/review/abc", "/support", "/contact"]) {
      expect(recordingAllowed(path)).toBe(false);
    }
    for (const path of ["/", "/products/luna-anklet", "/cart", "/checkout", "/payment-status", "/accountant-guide"]) {
      expect(recordingAllowed(path)).toBe(true);
    }
  });

  test("checkout methods map to one vocabulary", () => {
    expect(methodName("prepaid")).toBe("razorpay");
    expect(methodName("payu")).toBe("payu");
    expect(methodName("cod")).toBe("cod");
    expect(methodName("prepaid", true)).toBe("wallet");
  });
});

test.describe("trailing slashes (Next's own redirect is off for the analytics proxy)", () => {
  test("pages still redirect to the form without a slash; the root and slash-less URLs are left alone", () => {
    expect(trailingSlashRedirect(new URL("https://x.in/about/"))?.toString()).toBe("https://x.in/about");
    expect(trailingSlashRedirect(new URL("https://x.in/products/luna//?utm_source=a"))?.toString()).toBe("https://x.in/products/luna?utm_source=a");
    expect(trailingSlashRedirect(new URL("https://x.in/"))).toBeNull();
    expect(trailingSlashRedirect(new URL("https://x.in/about"))).toBeNull();
  });
});

test.describe("consent", () => {
  test("only a well-formed, current choice is read; anything else means not asked yet", () => {
    const at = "2026-11-28T10:00:00.000Z";
    expect(parseConsent(`granted.1.${at}`)).toEqual({ status: "granted", version: 1, at });
    expect(parseConsent(encodeURIComponent(`denied.1.${at}`))).toEqual({ status: "denied", version: 1, at });
    for (const bad of [undefined, "", "granted", "yes.1." + at, `granted.0.${at}`, "granted.1.yesterday"]) expect(parseConsent(bad)).toBeNull();
    expect(parseConsent(encodeConsent({ status: "granted", version: CONSENT_VERSION, at }))).toEqual({ status: "granted", version: 1, at });
  });

  test("only an explicit yes allows analytics", () => {
    const at = "2026-11-28T10:00:00.000Z";
    expect(analyticsAllowed({ status: "granted", version: 1, at })).toBe(true);
    expect(analyticsAllowed({ status: "denied", version: 1, at })).toBe(false);
    expect(analyticsAllowed(null)).toBe(false);
    expect(analyticsAllowed(consentFromCookieHeader(`a=b; ${CONSENT_COOKIE}=granted.1.${at}; c=d`))).toBe(true);
    expect(analyticsAllowed(consentFromCookieHeader("a=b"))).toBe(false);
  });

  test("withdrawal removes PostHog's cookies and storage, and only those", () => {
    for (const key of ["ph_phc_abc_posthog", "__ph_opt_in_out_phc_abc", "ph_phc_abc_window_id"]) expect(isPosthogStorageKey(key)).toBe(true);
    for (const key of [CONSENT_COOKIE, "__session", "__clerk_db_jwt", "eyra-cart", "phone"]) expect(isPosthogStorageKey(key)).toBe(false);
  });
});

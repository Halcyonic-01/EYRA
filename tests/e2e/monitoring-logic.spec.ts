import { test, expect } from "@playwright/test";
import type { ErrorEvent } from "@sentry/nextjs";

import { logArea, logMessage } from "../../lib/monitoring/console-errors";
import { browserTracePropagationTargets, isPersonalKey, scrubBreadcrumb, scrubEvent, scrubSpan, scrubText, scrubUrl, sentryEnvironment, sentryOptions } from "../../lib/monitoring/sentry";

// What Sentry receives: personal data removed from messages, URLs, requests
// and breadcrumbs, and the right environment. Pure logic: no server.

test.describe("Sentry settings", () => {
  test("off without a DSN, never sends personal data, traces one request in ten", () => {
    expect(sentryOptions({ environment: "development" })).toMatchObject({
      enabled: false,
      // Sentry 11 collects cookies, bodies and user details unless told not to.
      dataCollection: { userInfo: false, cookies: false, httpBodies: [], urlQueryParams: false, stackFrameVariables: false },
    });
    expect(sentryOptions({ dsn: "https://k@o1.ingest.sentry.io/1", environment: "production" })).toMatchObject({ enabled: true, tracesSampleRate: 0.1 });
  });

  test("environment: an explicit name, else Vercel's, else development", () => {
    expect(sentryEnvironment({})).toBe("development");
    expect(sentryEnvironment({ vercel: "preview" })).toBe("preview");
    expect(sentryEnvironment({ override: "staging", vercel: "preview" })).toBe("staging");
  });
});

test.describe("the privacy filter", () => {
  test("emails and Indian phone numbers in text are replaced, ids and amounts are kept", () => {
    expect(scrubText("email asha.rao@example.com failed for cart_01ABC")).toBe("email [email] failed for cart_01ABC");
    expect(scrubText("call +91 98765 43210? no: +91-9876543210 or 9876543210")).toBe("call +91 98765 43210? no: [phone] or [phone]");
    expect(scrubText("order total 2099, awb 123456789012")).toBe("order total 2099, awb 123456789012");
  });

  test("URLs lose private tokens and query values; parameter names stay", () => {
    expect(scrubUrl("https://www.eyra.org.in/review/SECRETTOKEN?utm_source=x#top")).toBe("https://www.eyra.org.in/review/[token]?utm_source=[filtered]");
    expect(scrubUrl("/api/newsletter/unsubscribe?token=abc&email=a%40b.com")).toBe("/api/newsletter/unsubscribe?token=[filtered]&email=[filtered]");
    expect(scrubUrl("https://www.eyra.org.in/products/luna")).toBe("https://www.eyra.org.in/products/luna");
  });

  test("an error event keeps its stack and ids but loses the request's personal parts", () => {
    const event = {
      type: undefined,
      message: "sync failed for 9876543210",
      user: { id: "cus_1", email: "a@b.com", ip_address: "1.2.3.4" },
      request: {
        url: "https://www.eyra.org.in/review/TOKEN?email=a@b.com",
        query_string: "email=a@b.com",
        cookies: { __session: "jwt" },
        data: { phone: "9876543210" },
        headers: { "user-agent": "UA", cookie: "__session=jwt", authorization: "Bearer x", "x-razorpay-signature": "sig", referer: "https://www.eyra.org.in/review/TOKEN" },
      },
      exception: { values: [{ type: "Error", value: "could not email asha@example.com", stacktrace: { frames: [{ filename: "app/x.ts" }] } }] },
      extra: { arguments: ["[medusa-order] failed", { email: "a@b.com", cart_id: "cart_1", shipping_address: { address_1: "12 Lake Road" } }] },
      breadcrumbs: [{ category: "fetch", data: { url: "https://api.example.com/x?pincode=411001", method: "GET" } }, { category: "console", message: "sent to a@b.com" }],
    } as unknown as ErrorEvent;
    const out = scrubEvent(event);
    expect(out.user).toBeUndefined();
    expect(out.message).toBe("sync failed for [phone]");
    expect(out.request).toEqual({ url: "https://www.eyra.org.in/review/[token]?email=[filtered]", headers: { "user-agent": "UA", referer: "https://www.eyra.org.in/review/[token]" } });
    expect(out.exception?.values?.[0]).toMatchObject({ value: "could not email [email]", stacktrace: { frames: [{ filename: "app/x.ts" }] } });
    expect(out.extra).toEqual({ arguments: ["[medusa-order] failed", { email: "[filtered]", cart_id: "cart_1", shipping_address: "[filtered]" }] });
    expect(out.breadcrumbs?.[0].data).toEqual({ url: "https://api.example.com/x?pincode=[filtered]", method: "GET" });
    expect(out.breadcrumbs?.[1].message).toBe("sent to [email]");
    expect(JSON.stringify(out)).not.toMatch(/a@b\.com|9876543210|Lake Road|jwt|Bearer|TOKEN\b/);
  });

  test("navigation breadcrumbs lose tokens on both ends", () => {
    expect(scrubBreadcrumb({ category: "navigation", data: { from: "/review/abc", to: "/orders/success?orderId=order_1" } })?.data).toEqual({ from: "/review/[token]", to: "/orders/success?orderId=[filtered]" });
  });
});

test.describe("caught server failures", () => {
  test("only EYRA's tagged logs are reported; Next's own crash logs are left to onRequestError", () => {
    expect(logArea(["[medusa-order] cart fetch error for", "cart_1", ":", new Error("x")])).toBe("medusa-order");
    expect(logArea(["⨯", new Error("crash")])).toBeNull();
    expect(logArea([new Error("crash")])).toBeNull();
    expect(logMessage(["[medusa-order] cart fetch 500 for", "cart_1", new Error("x"), { status: 500 }])).toBe('[medusa-order] cart fetch 500 for cart_1 {"status":500}');
  });

  test("the log line is filtered like everything else", () => {
    const out = scrubEvent({ type: undefined, contexts: { log: { message: "[email] not sent to asha@example.com" } } } as unknown as ErrorEvent);
    expect(out.contexts?.log).toEqual({ message: "[email] not sent to [email]" });
  });
});

test.describe("the privacy filter fails closed", () => {
  // Sentinels that must never reach Sentry, wherever they are put.
  const SECRETS = {
    email: "leak.person@example.com",
    phone: "9812345678",
    address: "42 Secret Lane",
    jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.c2lnbmF0dXJlMTIz",
    bearer: "s3cr3tB3arerT0ken",
    card: "4111 1111 1111 1111",
    key: "rzp_live_ABCDEFGH12345",
    review: "PRIVREVIEWTOKEN42",
    password: "hunter2pass",
  };
  const deep = (levels: number, leaf: unknown): unknown => (levels === 0 ? leaf : { level: deep(levels - 1, leaf) });

  function poisoned(): ErrorEvent {
    const cycle: Record<string, unknown> = { note: `cycle ${SECRETS.email}` };
    cycle.self = cycle;
    return {
      event_id: "abc123",
      release: "sha1",
      environment: "production",
      message: `could not reach ${SECRETS.email} at ${SECRETS.phone}`,
      logentry: { message: "%s failed", params: [{ customerEmail: SECRETS.email }, `Bearer ${SECRETS.bearer}`] },
      user: { id: "cus_1", email: SECRETS.email, ip_address: "203.0.113.9" },
      request: {
        method: "POST",
        url: `https://www.eyra.org.in/review/${SECRETS.review}?phone=${SECRETS.phone}`,
        query_string: `phone=${SECRETS.phone}`,
        cookies: { __session: SECRETS.jwt },
        data: { shippingAddress: { line1: SECRETS.address } },
        env: { REMOTE_ADDR: "203.0.113.9", SECRET: SECRETS.password },
        headers: { "user-agent": "UA", "x-forwarded-for": "203.0.113.9", authorization: `Bearer ${SECRETS.bearer}`, referer: `https://www.eyra.org.in/review/${SECRETS.review}` },
        unexpected_field: { contactPhone: SECRETS.phone },
      },
      exception: {
        values: [
          { type: "Error", value: `card ${SECRETS.card} refused for ${SECRETS.email}`, mechanism: { type: "generic", handled: true, data: { phoneNumber: SECRETS.phone } }, stacktrace: { frames: [{ filename: "app/api/x/route.ts", lineno: 12, vars: { password: SECRETS.password, body: SECRETS.address } }] } },
          { type: "TypeError", value: `cause: token=${SECRETS.password}` },
        ],
      },
      breadcrumbs: [
        { category: "fetch", data: { url: `https://api.example.com/v1?email=${SECRETS.email}`, nested: { deeper: { recipient: SECRETS.email } } } },
        { category: "console", message: `paid with key ${SECRETS.key}`, data: { arguments: [{ shipping_address: { address_1: SECRETS.address } }] } },
        { category: "navigation", data: { from: `/review/${SECRETS.review}`, to: "/orders" } },
      ],
      contexts: {
        trace: { trace_id: "0123456789abcdef0123456789abcdef", span_id: "0123456789abcdef", data: { "url.full": `https://x.in/a?email=${SECRETS.email}`, "http.query": `phone=${SECRETS.phone}` } },
        runtime: { name: "node", version: "v22" },
        log: { message: `[email] not sent to ${SECRETS.email}` },
        customer: { fullName: "Asha Rao", note: SECRETS.address },
      },
      tags: { log_area: "email", recipient: SECRETS.email },
      extra: { arguments: [deep(12, SECRETS.email)], cycle, awb: "123456789012", order_id: "order_01J", total: 2099 },
      fingerprint: [`[email] not sent to ${SECRETS.email}`],
      some_future_field: { buyer: { mobileNo: SECRETS.phone, text: `password: ${SECRETS.password}` } },
    } as unknown as ErrorEvent;
  }

  test("no sentinel survives anywhere in the event", () => {
    const sent = JSON.stringify(scrubEvent(poisoned()));
    for (const [what, secret] of Object.entries(SECRETS)) expect(sent, what).not.toContain(secret);
    expect(sent).not.toContain("203.0.113.9");
    expect(sent).not.toContain("Asha Rao");
  });

  test("what is needed to debug is kept", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a test reading deep into the event
    const out = scrubEvent(poisoned()) as unknown as Record<string, any>;
    expect(out).toMatchObject({ event_id: "abc123", release: "sha1", environment: "production" });
    expect(out.request).toEqual({ method: "POST", url: "https://www.eyra.org.in/review/[token]?phone=[filtered]", headers: { "user-agent": "UA", referer: "https://www.eyra.org.in/review/[token]" } });
    expect(out.exception.values[0].stacktrace.frames).toEqual([{ filename: "app/api/x/route.ts", lineno: 12 }]);
    expect(out.exception.values[0].value).toBe("card [card] refused for [email]");
    expect(out.contexts.trace).toMatchObject({ trace_id: "0123456789abcdef0123456789abcdef", span_id: "0123456789abcdef" });
    expect(out.contexts.runtime).toEqual({ name: "node", version: "v22" });
    expect(out.extra).toMatchObject({ awb: "123456789012", order_id: "order_01J", total: 2099 });
    expect(out.tags).toEqual({ log_area: "email", recipient: "[email]" });
    // An unknown context could hold free text nobody can recognise: it is dropped.
    expect(out.contexts.customer).toBeUndefined();
    expect(out.contexts.log).toEqual({ message: "[email] not sent to [email]" });
    expect(out.user).toBeUndefined();
  });

  test("keys are recognised in any casing; text secrets are recognised in any field", () => {
    for (const key of ["email", "customerEmail", "customer_email", "x-razorpay-signature", "phoneNumber", "shipping_address", "Authorization", "apiKey", "first_name", "ipAddress", "user.email"]) {
      expect(isPersonalKey(key), key).toBe(true);
    }
    for (const key of ["order_id", "cart_id", "awb", "status", "total", "log_area", "method", "url", "display_id"]) {
      expect(isPersonalKey(key), key).toBe(false);
    }
    expect(scrubText("pay 4111-1111-1111-1111 now, awb 77665544332211, order 1234567890123")).toBe("pay [card] now, awb 77665544332211, order 1234567890123");
    expect(scrubText("Authorization: Bearer abc.def.ghi and api_key=zzz9")).toBe("Authorization: [filtered] [filtered] and api_key=[filtered]");
  });
});

test("database errors lose the values they quote", () => {
  expect(scrubText(`insert into "customer" ("first_name") values ('Asha') - duplicate key`)).toBe(`insert into "customer" ("first_name") values ('[filtered]') - duplicate key`);
  expect(scrubText("Key (handle, title)=(luna, Asha's ring) already exists.")).toBe("Key (handle, title)=([filtered]) already exists.");
  expect(scrubText("it's 'fine' to keep quotes in ordinary text")).toBe("it's 'fine' to keep quotes in ordinary text");
});

test("streamed spans (Sentry 11 sends them one by one) lose session tokens and query values", () => {
  const jwt = "eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.c2lnbmF0dXJlLXZhbHVl";
  const span = {
    name: `GET /review/PRIVATE1?__clerk_handshake=${jwt}`,
    span_id: "ae184987ab65641e",
    trace_id: "17854fec175e4ff4b4c028c5ac19f8ff",
    start_timestamp: 1,
    end_timestamp: 2,
    is_segment: false,
    status: "ok",
    attributes: {
      "http.target": { value: `/?__clerk_handshake=${jwt}`, type: "string" },
      "url.full": { value: `https://www.eyra.org.in/checkout?email=a%40b.com`, type: "string" },
      "url.query": { value: `__clerk_handshake=${jwt}`, type: "string" },
      "http.method": { value: "GET", type: "string" },
      "user.email": { value: "asha@example.com", type: "string" },
      "sentry.segment.id": { value: "8149477152e8aeba", type: "string" },
      "sentry.segment.name": { value: "GET /review/PRIVATE1", type: "string" },
    },
  } as unknown as Parameters<typeof scrubSpan>[0];
  const out = scrubSpan(span);
  const sent = JSON.stringify(out);
  for (const secret of [jwt, "PRIVATE1", "asha@example.com", "a%40b.com"]) expect(sent).not.toContain(secret);
  expect(out.attributes).toMatchObject({
    "http.target": { value: "/?__clerk_handshake=[filtered]" },
    "url.full": { value: "https://www.eyra.org.in/checkout?email=[filtered]" },
    "http.method": { value: "GET" },
    "user.email": { value: "[filtered]" },
    "sentry.segment.id": { value: "8149477152e8aeba" },
    "sentry.segment.name": { value: "GET /review/[token]" },
  });
  expect(out.attributes?.["url.query"]).toBeUndefined();
  expect(out).toMatchObject({ span_id: "ae184987ab65641e", trace_id: "17854fec175e4ff4b4c028c5ac19f8ff" });
  expect(sentryOptions({ environment: "production" }).beforeSendSpan).toBe(scrubSpan);
});

test("browser trace headers go to this site's own requests, never to the analytics proxy", () => {
  const [target] = browserTracePropagationTargets("https://www.eyra.org.in");
  for (const url of ["/api/cart", "/products/luna", "https://www.eyra.org.in/api/payu/status", "/evening-wear", "/events"]) expect(target.test(url), url).toBe(true);
  for (const url of ["/ev", "/ev/e/?ip=0", "/ev/flags/?v=2", "https://www.eyra.org.in/ev/e/", "//cdn.example.com/x", "https://api.razorpay.com/v1", "https://www.eyra.org.in.evil.com/api"]) expect(target.test(url), url).toBe(false);
});

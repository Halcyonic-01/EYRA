import { test, expect } from "@playwright/test";
import { LOGO_CID } from "../../lib/email-layout";
import { sendThroughResend } from "../../lib/resend-send";

// The call to Resend, with a fake fetch standing in for it.

type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

function fakeResend(replies: Array<number | Error>) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(String(init.body)),
    });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (reply instanceof Error) throw reply;
    return new Response(reply === 200 ? JSON.stringify({ id: "email_1" }) : "{}", { status: reply });
  }) as unknown as typeof fetch;
  return { calls, deps: { fetch: fetchFn, wait: async () => {} } };
}

const live = { EMAIL_MODE: "live", RESEND_API_KEY: "re_test_key" };
const mail = { to: "asha@example.com", subject: "Shipped", html: "<p>Hi</p>" };

test.describe("sending through Resend", () => {
  test("sends to the customer in live mode, with the key and a sender", async () => {
    const resend = fakeResend([200]);
    expect(await sendThroughResend(mail, live, resend.deps)).toBe(true);

    expect(resend.calls).toHaveLength(1);
    expect(resend.calls[0].url).toBe("https://api.resend.com/emails");
    expect(resend.calls[0].headers.Authorization).toBe("Bearer re_test_key");
    expect(resend.calls[0].body).toMatchObject({ to: ["asha@example.com"], subject: "Shipped", html: "<p>Hi</p>" });
    expect(String(resend.calls[0].body.from)).toContain("@eyra.org.in");
  });

  test("in test mode only the test address is contacted", async () => {
    const resend = fakeResend([200]);
    const env = { ...live, EMAIL_MODE: "test", EMAIL_TEST_RECIPIENT: "me@example.com" };
    expect(await sendThroughResend(mail, env, resend.deps)).toBe(true);

    expect(resend.calls[0].body.to).toEqual(["me@example.com"]);
    expect(resend.calls[0].body.subject).toBe("[TEST for asha@example.com] Shipped");
    expect(JSON.stringify(resend.calls[0].body)).not.toContain('"asha@example.com"');
  });

  test("never calls Resend when the mode says not to, or there is no key", async () => {
    const resend = fakeResend([200]);
    expect(await sendThroughResend(mail, { ...live, EMAIL_MODE: "off" }, resend.deps)).toBe(false);
    expect(await sendThroughResend(mail, { EMAIL_MODE: "live" }, resend.deps)).toBe(false);
    expect(await sendThroughResend({ ...mail, category: "promotional" }, live, resend.deps)).toBe(false);
    expect(resend.calls).toHaveLength(0);
  });

  test("passes the idempotency key and the one-click unsubscribe headers on", async () => {
    const resend = fakeResend([200]);
    await sendThroughResend(
      { ...mail, category: "promotional", idempotencyKey: "promo:diwali:cus_1", unsubscribeUrl: "https://www.eyra.org.in/u?e=a" },
      { ...live, EMAIL_PROMOTIONS_ENABLED: "true" },
      resend.deps
    );

    expect(resend.calls[0].headers["Idempotency-Key"]).toBe("promo:diwali:cus_1");
    expect(resend.calls[0].body.headers).toEqual({
      "List-Unsubscribe": "<https://www.eyra.org.in/u?e=a>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  test("attaches the logo inline when the email uses it, and nothing when it does not", async () => {
    const withLogo = fakeResend([200]);
    await sendThroughResend({ ...mail, html: `<img src="cid:${LOGO_CID}">` }, live, withLogo.deps);
    const attachments = withLogo.calls[0].body.attachments as Record<string, string>[];
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({ filename: "eyra-logo.png", content_type: "image/png", content_id: LOGO_CID });
    // A real PNG: base64 of the PNG signature.
    expect(attachments[0].content.startsWith("iVBORw0KGgo")).toBe(true);

    const without = fakeResend([200]);
    await sendThroughResend(mail, live, without.deps);
    expect(without.calls[0].body.attachments).toBeUndefined();
  });

  test("a refusal is reported, not thrown", async () => {
    const resend = fakeResend([422]);
    expect(await sendThroughResend(mail, live, resend.deps)).toBe(false);
    expect(resend.calls).toHaveLength(1);
  });

  test("retries a busy Resend (429) and a server error when the repeat is safe", async () => {
    const busy = fakeResend([429, 200]);
    expect(await sendThroughResend(mail, live, busy.deps)).toBe(true);
    expect(busy.calls).toHaveLength(2);

    const keyed = fakeResend([503, 200]);
    expect(await sendThroughResend({ ...mail, idempotencyKey: "k" }, live, keyed.deps)).toBe(true);
    expect(keyed.calls).toHaveLength(2);
    expect(keyed.calls[1].headers["Idempotency-Key"]).toBe("k");
  });

  test("does not repeat a send that might have gone through, when Resend cannot tell it is a repeat", async () => {
    const serverError = fakeResend([503, 200]);
    expect(await sendThroughResend(mail, live, serverError.deps)).toBe(false);
    expect(serverError.calls).toHaveLength(1);

    const dropped = fakeResend([new Error("socket hang up"), 200]);
    expect(await sendThroughResend(mail, live, dropped.deps)).toBe(false);
    expect(dropped.calls).toHaveLength(1);
  });

  test("gives up after two tries", async () => {
    const down = fakeResend([new Error("down")]);
    expect(await sendThroughResend({ ...mail, idempotencyKey: "k" }, live, down.deps)).toBe(false);
    expect(down.calls).toHaveLength(2);
  });
});

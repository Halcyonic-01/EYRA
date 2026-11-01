import { test, expect } from "@playwright/test";
import { planDelivery, resolveEmailMode } from "../../lib/email-delivery";

// The rules that stop a developer's machine, a preview build or a mistake from
// emailing a real customer.

test.describe("email mode", () => {
  test("production is live and everything else is test, unless set", () => {
    expect(resolveEmailMode({ NODE_ENV: "production" })).toBe("live");
    expect(resolveEmailMode({ NODE_ENV: "development" })).toBe("test");
    expect(resolveEmailMode({})).toBe("test");
  });

  test("a Vercel preview is test even though NODE_ENV says production", () => {
    expect(resolveEmailMode({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe("test");
    expect(resolveEmailMode({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe("live");
  });

  test("EMAIL_MODE wins, and a typo falls back to the safe default", () => {
    expect(resolveEmailMode({ NODE_ENV: "development", EMAIL_MODE: "live" })).toBe("live");
    expect(resolveEmailMode({ NODE_ENV: "production", EMAIL_MODE: " OFF " })).toBe("off");
    expect(resolveEmailMode({ NODE_ENV: "development", EMAIL_MODE: "lve" })).toBe("test");
  });
});

test.describe("planning a delivery", () => {
  const mail = { to: "asha@example.com", subject: "Your order has shipped" };

  test("live sends to the real customer as written", () => {
    expect(planDelivery(mail, { EMAIL_MODE: "live" })).toEqual({
      action: "send",
      mode: "live",
      to: "asha@example.com",
      subject: "Your order has shipped",
    });
  });

  test("test mode sends only to the test address and says who it was for", () => {
    const plan = planDelivery(mail, { EMAIL_MODE: "test", EMAIL_TEST_RECIPIENT: "me@example.com" });
    expect(plan).toMatchObject({ action: "send", to: "me@example.com" });
    expect((plan as { subject: string }).subject).toBe("[TEST for asha@example.com] Your order has shipped");
  });

  test("test mode with no usable test address sends nothing rather than falling back to the customer", () => {
    expect(planDelivery(mail, { EMAIL_MODE: "test" }).action).toBe("skip");
    expect(planDelivery(mail, { EMAIL_MODE: "test", EMAIL_TEST_RECIPIENT: "not-an-address" }).action).toBe("skip");
  });

  test("off sends nothing", () => {
    expect(planDelivery(mail, { EMAIL_MODE: "off", EMAIL_TEST_RECIPIENT: "me@example.com" }).action).toBe("skip");
  });

  test("promotional email needs its own switch in live mode", () => {
    const promo = { ...mail, category: "promotional" as const };
    expect(planDelivery(promo, { EMAIL_MODE: "live" }).action).toBe("skip");
    expect(planDelivery(promo, { EMAIL_MODE: "live", EMAIL_PROMOTIONS_ENABLED: "false" }).action).toBe("skip");
    expect(planDelivery(promo, { EMAIL_MODE: "live", EMAIL_PROMOTIONS_ENABLED: "true" })).toMatchObject({
      action: "send",
      to: "asha@example.com",
    });
  });

  test("promotional email can be tried in test mode with the switch off, since it reaches only the tester", () => {
    const promo = { ...mail, category: "promotional" as const };
    expect(planDelivery(promo, { EMAIL_MODE: "test", EMAIL_TEST_RECIPIENT: "me@example.com" })).toMatchObject({
      action: "send",
      to: "me@example.com",
    });
  });

  test("order emails are not held back by the promotions switch", () => {
    expect(planDelivery(mail, { EMAIL_MODE: "live", EMAIL_PROMOTIONS_ENABLED: "false" }).action).toBe("send");
  });
});

import { test, expect } from "@playwright/test";
import {
  cancelledByCustomer,
  checkedPayuForm,
  isPayuCheckoutUrl,
  loopbackOrigin,
  looksLikePayuReturn,
  payuView,
  pickReturnFields,
  type PayuOutcomeStatus,
} from "../../lib/payu";
import { decodeReturnCookie, encodeReturnCookie } from "../../lib/payu-cookie";

// The storefront's PayU rules. Pure logic: no server.

const FORM = {
  action: "https://secure.payu.in/_payment",
  method: "POST",
  fields: { key: "k", txnid: "eyra_1", amount: "1199.00", hash: "a".repeat(128), surl: "https://www.eyra.org.in/api/payu/return" },
};

test.describe("the hosted checkout address", () => {
  test("only PayU's own checkout over https", () => {
    expect(isPayuCheckoutUrl("https://secure.payu.in/_payment")).toBe(true);
    expect(isPayuCheckoutUrl("https://test.payu.in/_payment")).toBe(true);
    for (const bad of [
      "http://secure.payu.in/_payment",
      "https://secure.payu.in.evil.com/_payment",
      "https://evil.com/_payment",
      "https://secure.payu.in/other",
      "javascript:alert(1)",
      "not a url",
    ]) expect(isPayuCheckoutUrl(bad)).toBe(false);
  });

  test("a local fake only when its exact origin is configured", () => {
    expect(isPayuCheckoutUrl("http://127.0.0.1:19443/_payment")).toBe(false);
    expect(isPayuCheckoutUrl("http://127.0.0.1:19443/_payment", "http://127.0.0.1:19443")).toBe(true);
    expect(isPayuCheckoutUrl("http://127.0.0.1:19444/_payment", "http://127.0.0.1:19443")).toBe(false);
  });

  test("the test-only fake origin is honoured for this machine only, never a real host", () => {
    expect(loopbackOrigin("http://127.0.0.1:19443")).toBe("http://127.0.0.1:19443");
    expect(loopbackOrigin("http://localhost:19443/")).toBe("http://localhost:19443");
    for (const bad of ["https://evil.example.com", "http://127.0.0.1.evil.com", "http://10.0.0.5:19443", "not a url", "", undefined]) {
      expect(loopbackOrigin(bad)).toBeNull();
    }
    // So a stray production setting cannot point checkout at another site.
    expect(isPayuCheckoutUrl("https://evil.example.com/_payment", loopbackOrigin("https://evil.example.com"))).toBe(false);
  });

  test("the backend's form is used only when it is complete", () => {
    expect(checkedPayuForm(FORM)).toEqual(FORM);
    expect(checkedPayuForm({ ...FORM, action: "https://evil.com/_payment" })).toBeNull();
    expect(checkedPayuForm({ ...FORM, fields: { ...FORM.fields, amount: 1199 } })).toBeNull();
    expect(checkedPayuForm({ ...FORM, fields: { ...FORM.fields, hash: "" } })).toBeNull();
    expect(checkedPayuForm(null)).toBeNull();
  });
});

test.describe("what PayU posts back", () => {
  const posted = {
    key: "k", txnid: "eyra_1", amount: "1199.00", productinfo: "EYRA order", firstname: "Asha", email: "a@example.com",
    udf1: "cart_1", status: "success", hash: "b".repeat(128), mihpayid: "403993715", unmappedstatus: "captured",
    cardnum: "512345XXXXXX2346", name_on_card: "ASHA", bank_ref_num: "123", field9: "x",
  };

  test("keeps only what the backend checks, never card details", () => {
    const fields = pickReturnFields(posted);
    expect(fields).not.toHaveProperty("cardnum");
    expect(fields).not.toHaveProperty("name_on_card");
    expect(fields).not.toHaveProperty("bank_ref_num");
    expect(fields).toMatchObject({ txnid: "eyra_1", hash: "b".repeat(128), status: "success", mihpayid: "403993715" });
    expect(looksLikePayuReturn(fields)).toBe(true);
  });

  test("drops values that are not strings or are too long", () => {
    const fields = pickReturnFields({ ...posted, txnid: ["a"], email: "x".repeat(600) });
    expect(fields.txnid).toBeUndefined();
    expect(fields.email).toBeUndefined();
    expect(looksLikePayuReturn(fields)).toBe(false);
  });

  test("survive the status cookie, and a tampered cookie is reduced to the same fields", () => {
    const fields = pickReturnFields(posted);
    expect(decodeReturnCookie(encodeReturnCookie(fields))).toEqual(fields);
    const extra = Buffer.from(JSON.stringify({ ...fields, status: "success", injected: "<script>" })).toString("base64url");
    expect(decodeReturnCookie(extra)).not.toHaveProperty("injected");
    expect(decodeReturnCookie("not base64 json")).toBeNull();
    expect(decodeReturnCookie(undefined)).toBeNull();
  });

  test("a cancelled payment is told apart for the wording only", () => {
    expect(cancelledByCustomer({ unmappedstatus: "userCancelled" })).toBe(true);
    expect(cancelledByCustomer({ unmappedstatus: "failed" })).toBe(false);
  });
});

test.describe("what the customer is shown", () => {
  test("success only when the backend reports an order", () => {
    const statuses: PayuOutcomeStatus[] = ["order", "pending", "processing", "failed", "refunded", "unverified", "unavailable"];
    const confirmed = statuses.filter((status) => payuView({ status, cancelled: false }).kind === "confirmed");
    expect(confirmed).toEqual(["order"]);
  });

  test("pending and unreachable keep waiting; a failure says nothing was taken", () => {
    expect(payuView({ status: "pending", cancelled: false }).kind).toBe("waiting");
    expect(payuView({ status: "processing", cancelled: false }).kind).toBe("waiting");
    expect(payuView({ status: "unavailable", cancelled: false }).kind).toBe("waiting");
    expect(payuView({ status: "failed", cancelled: false })).toMatchObject({ kind: "failed", message: expect.stringContaining("no money was taken") });
    expect(payuView({ status: "failed", cancelled: true }).kind).toBe("cancelled");
    expect(payuView({ status: "refunded", cancelled: false }).kind).toBe("refunded");
    expect(payuView({ status: "unverified", cancelled: false }).kind).toBe("unverified");
  });
});

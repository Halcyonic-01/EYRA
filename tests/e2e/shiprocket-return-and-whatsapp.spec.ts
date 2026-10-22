import { test, expect } from "@playwright/test";

import { buildReturnOrderPayload, createReturnOrder, reversePickupProblems, type ReversePickupRequest } from "../../lib/shiprocket-return";
import {
  buildAisensyRequest,
  buildWatiRequest,
  providerFrom,
  sendWhatsappMessage,
  templateName,
  templateValues,
  type WhatsappMessage,
} from "../../lib/whatsapp";

// Both call outside services, so each takes its network and settings as arguments
// and these run without them. The request shapes follow the providers' published
// APIs; they have not been run against the live services.

const pickup: ReversePickupRequest = {
  return_request_id: "retreq_1",
  order_ref: "EYRA-21",
  reverse_order_ref: "EYRA-21-R1",
  type: "return",
  reason: "SIZE_ISSUE",
  pickup: { fullName: "Asha Rao", addressLine1: "12 Lake Road", city: "Pune", state: "Maharashtra", pincode: "411001", phone: "+91 99999 99999", email: "asha@example.com" },
  items: [{ name: "Luna Anklet", sku: "LUNA-PAIR", quantity: 1, price: 3800, packSize: 2 }],
};
const warehouse = {
  name: "EYRA JEWELS", addressLine1: "Ward 12", addressLine2: "", city: "Garhwa", state: "Jharkhand", pincode: "822114", phone: "9876543210", email: "orders@example.com",
};
const parcel = { box: { length: 10, breadth: 8, height: 3 }, weightKg: 0.5 };

test.describe("reverse pickup request", () => {
  test("is the customer's address to our warehouse, prepaid, under the reverse reference", () => {
    const payload = buildReturnOrderPayload(pickup, warehouse, parcel, new Date("2026-10-21T10:00:00Z"));
    expect(payload).toMatchObject({
      order_id: "EYRA-21-R1",
      order_date: "2026-10-21",
      pickup_customer_name: "Asha",
      pickup_last_name: "Rao",
      pickup_address: "12 Lake Road",
      pickup_city: "Pune",
      pickup_state: "Maharashtra",
      pickup_pincode: 411001,
      pickup_phone: "9999999999",
      shipping_customer_name: "EYRA JEWELS",
      shipping_pincode: 822114,
      shipping_state: "Jharkhand",
      payment_method: "PREPAID",
      sub_total: 3800,
      weight: 0.5,
    });
    expect(payload.order_items).toEqual([{ name: "Luna Anklet", sku: "LUNA-PAIR", units: 1, selling_price: 3800, discount: 0, qc_enable: false }]);
  });

  test("refuses a request that cannot be booked", () => {
    expect(reversePickupProblems(pickup)).toBeNull();
    expect(reversePickupProblems({ ...pickup, reverse_order_ref: "bad ref" })).toMatch(/reference/);
    expect(reversePickupProblems({ ...pickup, items: [] })).toMatch(/nothing/);
    expect(reversePickupProblems({ ...pickup, pickup: { ...pickup.pickup, pincode: "41100" } })).toMatch(/pincode/);
    expect(reversePickupProblems({ ...pickup, pickup: { ...pickup.pickup, phone: "123" } })).toMatch(/phone/);
    expect(reversePickupProblems({ ...pickup, pickup: { ...pickup.pickup, addressLine1: "" } })).toMatch(/address/);
  });

  const fakeFetch = (replies: { status?: number; body: unknown }[]) => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    let i = 0;
    const impl = (async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      const reply = replies[Math.min(i++, replies.length - 1)];
      return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
    }) as unknown as typeof fetch;
    return { impl, calls };
  };

  test("creates the return order, then asks for its courier as a return", async () => {
    const { impl, calls } = fakeFetch([
      { body: { order_id: 555, shipment_id: 777 } },
      { body: { response: { data: { awb_code: "AWB-RET-1" } } } },
    ]);
    const outcome = await createReturnOrder(buildReturnOrderPayload(pickup, warehouse, parcel), "token", impl);
    expect(outcome).toEqual({ ok: true, shiprocketOrderId: "555", shipmentId: "777", awbCode: "AWB-RET-1" });
    expect(calls[0].url).toBe("https://apiv2.shiprocket.in/v1/external/orders/create/return");
    expect(calls[1].url).toBe("https://apiv2.shiprocket.in/v1/external/courier/assign/awb");
    expect(calls[1].body).toEqual({ shipment_id: 777, is_return: 1 });
  });

  test("still succeeds, with a warning, when no courier could be assigned", async () => {
    const { impl } = fakeFetch([{ body: { order_id: 5, shipment_id: 7 } }, { body: { response: { data: { awb_assign_error: "wallet empty" } } } }]);
    const outcome = await createReturnOrder(buildReturnOrderPayload(pickup, warehouse, parcel), "token", impl);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.awbCode).toBeNull();
      expect(outcome.warning).toMatch(/wallet empty/);
    }
  });

  test("fails when Shiprocket refuses the return order", async () => {
    const { impl } = fakeFetch([{ status: 422, body: { message: "Pickup pincode is not serviceable" } }]);
    const outcome = await createReturnOrder(buildReturnOrderPayload(pickup, warehouse, parcel), "token", impl);
    expect(outcome).toEqual({ ok: false, error: "Pickup pincode is not serviceable" });
  });
});

const message: WhatsappMessage = {
  template: "store_credit_issued",
  phone: "919999999999",
  name: "Asha",
  params: { amount: 1901, valid_until: "21 Oct 2027", credit_note: "CN/26-27/0042", order: "EYRA-21" },
};

test.describe("WhatsApp", () => {
  const wati = { WHATSAPP_PROVIDER: "wati", WATI_API_URL: "https://live-mt-server.wati.io/1234/", WATI_ACCESS_TOKEN: "tok" };
  const aisensy = { WHATSAPP_PROVIDER: "aisensy", AISENSY_API_KEY: "key" };

  test("is off until a provider is fully set up", () => {
    expect(providerFrom({})).toBeNull();
    expect(providerFrom({ WHATSAPP_PROVIDER: "wati" })).toBeNull();
    expect(providerFrom({ WHATSAPP_PROVIDER: "aisensy" })).toBeNull();
    expect(providerFrom(wati)).toBe("wati");
    expect(providerFrom(aisensy)).toBe("aisensy");
  });

  test("fills a template's values in its fixed order, with rupees written out", () => {
    expect(templateValues(message)).toEqual(["Asha", "₹1,901", "21 Oct 2027", "CN/26-27/0042", "EYRA-21"]);
    expect(templateValues({ ...message, name: null, params: {} })).toEqual(["there", "", "", "", ""]);
    expect(
      templateValues({ template: "exchange_payment_link", phone: "919999999999", name: "Asha", params: { amount: 1099, link: "https://rzp.io/i/x", order: "EYRA-21" } })
    ).toEqual(["Asha", "₹1,099", "https://rzp.io/i/x", "EYRA-21"]);
  });

  test("template names can be changed in settings", () => {
    expect(templateName("store_credit_issued", {})).toBe("eyra_store_credit_issued");
    expect(templateName("store_credit_issued", { WHATSAPP_TEMPLATE_STORE_CREDIT: "my_template" })).toBe("my_template");
  });

  test("a WATI request carries the number, the template and numbered parameters", () => {
    const request = buildWatiRequest(message, wati);
    expect(request.url).toBe("https://live-mt-server.wati.io/1234/api/v1/sendTemplateMessage?whatsappNumber=919999999999");
    expect(request.init.headers.Authorization).toBe("Bearer tok");
    const body = JSON.parse(request.init.body);
    expect(body.template_name).toBe("eyra_store_credit_issued");
    expect(body.parameters[0]).toEqual({ name: "1", value: "Asha" });
    expect(body.parameters).toHaveLength(5);
  });

  test("an AiSensy request carries the key, campaign, destination and parameters", () => {
    const body = JSON.parse(buildAisensyRequest(message, aisensy).init.body);
    expect(body).toMatchObject({ apiKey: "key", campaignName: "eyra_store_credit_issued", destination: "919999999999", userName: "Asha" });
    expect(body.templateParams).toHaveLength(5);
  });

  test("sends nothing and says so when no provider is set up", async () => {
    let called = false;
    const result = await sendWhatsappMessage(message, {}, (async () => {
      called = true;
      return new Response("{}");
    }) as unknown as typeof fetch);
    expect(result).toEqual({ sent: false, skipped: "not_configured" });
    expect(called).toBe(false);
  });

  test("reports a provider that refuses, however it says so", async () => {
    const refuses = (async () => new Response("{}", { status: 400 })) as unknown as typeof fetch;
    expect(await sendWhatsappMessage(message, wati, refuses)).toEqual({ sent: false, error: "wati answered 400" });
    const quiet = (async () => new Response(JSON.stringify({ result: false }))) as unknown as typeof fetch;
    expect(await sendWhatsappMessage(message, wati, quiet)).toEqual({ sent: false, error: "wati did not accept the message" });
    const accepts = (async () => new Response(JSON.stringify({ result: true }))) as unknown as typeof fetch;
    expect(await sendWhatsappMessage(message, wati, accepts)).toEqual({ sent: true });
    expect(await sendWhatsappMessage(message, aisensy, accepts)).toEqual({ sent: true });
  });
});

/**
 * WhatsApp messages to customers, through WATI or AiSensy (set WHATSAPP_PROVIDER).
 * Nothing is sent, and nothing fails, when no provider is set up.
 *
 * Both providers send an approved template with numbered parameters, so each
 * message is a template name and a list of values in a fixed order. The
 * request builders are pure so they can be tested; the sender takes the
 * environment and fetch as arguments. The shapes follow each provider's
 * published API and have not been run against the live services.
 */

export type WhatsappTemplate = "store_credit_issued" | "exchange_payment_link" | "replacement_dispatched";

export interface WhatsappMessage {
  template: WhatsappTemplate;
  /** 91 and ten digits. */
  phone: string;
  name: string | null;
  params: Record<string, string | number>;
}

type Env = Record<string, string | undefined>;

/** The values of each template, in the order its approved text numbers them. */
export const TEMPLATE_PARAMS: Record<WhatsappTemplate, readonly string[]> = {
  store_credit_issued: ["name", "amount", "valid_until", "credit_note", "order"],
  exchange_payment_link: ["name", "amount", "link", "order"],
  replacement_dispatched: ["name", "order", "title"],
};

const DEFAULT_TEMPLATE_NAMES: Record<WhatsappTemplate, string> = {
  store_credit_issued: "eyra_store_credit_issued",
  exchange_payment_link: "eyra_exchange_payment_link",
  replacement_dispatched: "eyra_replacement_dispatched",
};

const ENV_TEMPLATE_NAMES: Record<WhatsappTemplate, string> = {
  store_credit_issued: "WHATSAPP_TEMPLATE_STORE_CREDIT",
  exchange_payment_link: "WHATSAPP_TEMPLATE_EXCHANGE_LINK",
  replacement_dispatched: "WHATSAPP_TEMPLATE_REPLACEMENT",
};

export function templateName(template: WhatsappTemplate, env: Env): string {
  return env[ENV_TEMPLATE_NAMES[template]]?.trim() || DEFAULT_TEMPLATE_NAMES[template];
}

/** The values for a template, in order, as text. A missing one is an empty string. */
export function templateValues(message: WhatsappMessage): string[] {
  const all: Record<string, string | number | null> = { ...message.params, name: message.name ?? "there" };
  return TEMPLATE_PARAMS[message.template].map((key) => {
    const value = all[key];
    if (typeof value === "number") return key === "amount" ? `₹${Math.round(value).toLocaleString("en-IN")}` : String(value);
    return value ?? "";
  });
}

export type Provider = "wati" | "aisensy";

export function providerFrom(env: Env): Provider | null {
  const chosen = env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  if (chosen === "wati" && env.WATI_API_URL && env.WATI_ACCESS_TOKEN) return "wati";
  if (chosen === "aisensy" && env.AISENSY_API_KEY) return "aisensy";
  return null;
}

export interface ProviderRequest {
  url: string;
  init: { method: "POST"; headers: Record<string, string>; body: string };
}

export function buildWatiRequest(message: WhatsappMessage, env: Env): ProviderRequest {
  const base = (env.WATI_API_URL ?? "").replace(/\/+$/, "");
  return {
    url: `${base}/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(message.phone)}`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.WATI_ACCESS_TOKEN ?? ""}` },
      body: JSON.stringify({
        template_name: templateName(message.template, env),
        broadcast_name: `eyra_${message.template}`,
        parameters: templateValues(message).map((value, index) => ({ name: String(index + 1), value })),
      }),
    },
  };
}

export function buildAisensyRequest(message: WhatsappMessage, env: Env): ProviderRequest {
  return {
    url: env.AISENSY_API_URL?.trim() || "https://backend.aisensy.com/campaign/t1/api/v2",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: env.AISENSY_API_KEY,
        campaignName: templateName(message.template, env),
        destination: message.phone,
        userName: message.name ?? "EYRA customer",
        templateParams: templateValues(message),
        source: "eyra-store",
      }),
    },
  };
}

export type SendResult = { sent: true } | { sent: false; skipped: "not_configured" } | { sent: false; error: string };

export async function sendWhatsappMessage(message: WhatsappMessage, env: Env, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const provider = providerFrom(env);
  if (!provider) return { sent: false, skipped: "not_configured" };
  const request = provider === "wati" ? buildWatiRequest(message, env) : buildAisensyRequest(message, env);
  try {
    const res = await fetchImpl(request.url, { ...request.init, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { sent: false, error: `${provider} answered ${res.status}` };
    // WATI answers 200 with result:false for a template or number it refuses.
    const body = (await res.json().catch(() => ({}))) as { result?: unknown };
    if (provider === "wati" && body.result === false) return { sent: false, error: "wati did not accept the message" };
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : String(error) };
  }
}

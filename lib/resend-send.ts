/**
 * The Resend call behind lib/email.ts, free of server-only code so it can be
 * tested with a fake fetch. Use sendEmail from lib/email.ts in the app.
 */
import { planDelivery, type EmailCategory } from "@/lib/email-delivery";
import { LOGO_CID } from "@/lib/email-layout";
import { EMAIL_LOGO_PNG_BASE64 } from "@/lib/email-logo";

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  from?: string;
  /** Promotional email has an extra switch and needs an unsubscribe link. */
  category?: EmailCategory;
  /**
   * Makes a repeat of the same send harmless: Resend ignores a second request
   * with the same key for 24 hours. For example `order-shipped:ord_123`.
   */
  idempotencyKey?: string;
  /** Adds the one-click unsubscribe headers mail apps show as an Unsubscribe button. */
  unsubscribeUrl?: string;
}

export interface SendDeps {
  fetch?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
}

const RETRY_DELAY_MS = 600;

export async function sendThroughResend(
  params: EmailParams,
  env: Record<string, string | undefined>,
  deps: SendDeps = {}
): Promise<boolean> {
  const plan = planDelivery(params, env);
  if (plan.action === "skip") {
    console.info(`[email] not sent (${plan.reason}): "${params.subject}" to ${params.to}`);
    return false;
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set, skipping "${params.subject}" to ${params.to}`);
    return false;
  }

  const post = deps.fetch ?? fetch;
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const from = params.from ?? env.EMAIL_FROM ?? "EYRA <noreply@eyra.org.in>";
  const body = JSON.stringify({
    from,
    to: [plan.to],
    subject: plan.subject,
    html: params.html,
    // The logo travels inside the email, so no "display images" click or hosting is needed.
    ...(params.html.includes(`cid:${LOGO_CID}`)
      ? {
          attachments: [
            { filename: "eyra-logo.png", content: EMAIL_LOGO_PNG_BASE64, content_type: "image/png", content_id: LOGO_CID },
          ],
        }
      : {}),
    ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    ...(params.unsubscribeUrl
      ? {
          headers: {
            "List-Unsubscribe": `<${params.unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...(params.idempotencyKey ? { "Idempotency-Key": params.idempotencyKey } : {}),
  };

  // A second try is safe only when Resend can tell it is a repeat, or when it
  // refused the first one outright (429).
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await post("https://api.resend.com/emails", {
        method: "POST",
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return true;

      const retryable = res.status === 429 || (res.status >= 500 && !!params.idempotencyKey);
      console.error(`[email] Resend API error ${res.status} (attempt ${attempt}):`, await res.text());
      if (!retryable || attempt === 2) return false;
    } catch (err) {
      console.error(`[email] send failed (attempt ${attempt}):`, err);
      if (!params.idempotencyKey || attempt === 2) return false;
    }
    await wait(RETRY_DELAY_MS);
  }
  return false;
}

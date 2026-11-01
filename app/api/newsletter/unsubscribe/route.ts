import type { NextRequest } from "next/server";

import { applyRateLimit } from "@/lib/rateLimit";
import { verifyUnsubscribe } from "@/lib/unsubscribe-token";

/**
 * Opting out of promotional email. The link in every offer email leads here.
 *
 * GET shows a confirm button, so a mail scanner that opens the link does not
 * unsubscribe anyone. POST does it: from that button, or from the mail app's
 * own one-click Unsubscribe (the List-Unsubscribe-Post header).
 *
 * The subscriber list is the Medusa customers tagged newsletter_subscriber, so
 * opting out turns that tag off. The backend sends offers only to tagged customers.
 */

const BASE_URL = (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000").replace(/\/$/, "");

const page = (title: string, body: string, status = 200): Response =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;background:#f9f9f9;font-family:Poppins,Helvetica,Arial,sans-serif;color:#020202;">
<main style="max-width:420px;margin:15vh auto;padding:0 24px;text-align:center;">
<img src="/images/logo-eyra-black.svg" width="132" height="77" alt="EYRA" style="display:block;margin:0 auto;">
${body}
</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );

function readLink(req: NextRequest): { email: string; token: string } | null {
  const email = req.nextUrl.searchParams.get("e")?.trim().toLowerCase();
  const token = req.nextUrl.searchParams.get("t") ?? "";
  if (!email || !verifyUnsubscribe(email, token)) return null;
  return { email, token };
}

const invalid = () =>
  page("Link not valid", `<p style="margin-top:32px;">This unsubscribe link is not valid. Write to us from the support page and we will remove you.</p>`, 400);

export async function GET(req: NextRequest) {
  const link = readLink(req);
  if (!link) return invalid();

  const action = `/api/newsletter/unsubscribe?e=${encodeURIComponent(link.email)}&t=${link.token}`;
  return page(
    "Unsubscribe",
    `<p style="margin-top:32px;line-height:24px;">Stop offers and updates from EYRA to <strong>${link.email.replace(/[<>&"']/g, "")}</strong>?<br>Order updates will still reach you.</p>
<form method="post" action="${action}"><button type="submit" style="margin-top:16px;background:#020202;color:#fff;border:0;border-radius:999px;padding:14px 32px;font-size:14px;cursor:pointer;">Unsubscribe</button></form>`
  );
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, "newsletter_unsubscribe", 10);
  if (limited) return limited;

  const link = readLink(req);
  if (!link) return invalid();

  const key = process.env.MEDUSA_ADMIN_API_KEY;
  if (!key) {
    console.error("[unsubscribe] MEDUSA_ADMIN_API_KEY is not set");
    return page("Try again later", `<p style="margin-top:32px;">We could not process this right now. Please try again later.</p>`, 503);
  }

  try {
    const headers = { "Content-Type": "application/json", Authorization: `Basic ${key}` };
    const found = await fetch(
      `${BASE_URL}/admin/customers?email=${encodeURIComponent(link.email)}&limit=1&fields=id`,
      { headers, cache: "no-store" }
    );
    if (!found.ok) throw new Error(`customer lookup answered ${found.status}`);

    const { customers } = (await found.json()) as { customers?: { id: string }[] };
    if (customers?.[0]) {
      const updated = await fetch(`${BASE_URL}/admin/customers/${customers[0].id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          metadata: { newsletter_subscriber: false, unsubscribed_at: new Date().toISOString() },
        }),
        cache: "no-store",
      });
      if (!updated.ok) throw new Error(`customer update answered ${updated.status}`);
    }
  } catch (err) {
    console.error("[unsubscribe] failed:", err);
    return page("Try again later", `<p style="margin-top:32px;">We could not process this right now. Please try again later.</p>`, 502);
  }

  // The same answer whether or not the address was on the list.
  return page("Unsubscribed", `<p style="margin-top:32px;line-height:24px;">You are unsubscribed. You will not get offers from us. Order updates will still reach you.</p>`);
}

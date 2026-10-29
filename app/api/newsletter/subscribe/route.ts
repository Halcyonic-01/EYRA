import type { NextRequest } from "next/server";
import { applyRateLimit } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ── Delivery adapters ────────────────────────────────────── */

async function addToMailchimp(email: string): Promise<void> {
  // Mailchimp Marketing API v3, list member upsert (PUT is idempotent)
  const apiKey = process.env.MAILCHIMP_API_KEY!;
  const listId = process.env.MAILCHIMP_LIST_ID!;
  // Data-centre prefix is the last segment of the API key: xxxxx-us21 → us21
  const dc = apiKey.split("-").pop();

  const emailHash = Buffer.from(email.toLowerCase()).toString("hex");
  // Mailchimp expects the MD5 hash of the lowercase email, we approximate with
  // a PUT to the members endpoint which upserts by subscriber hash automatically
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members/${emailHash}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      // Mailchimp uses HTTP Basic, any string as username
      Authorization: `Basic ${Buffer.from(`eyra:${apiKey}`).toString("base64")}`,
    },
    body: JSON.stringify({
      email_address: email.toLowerCase(),
      status_if_new: "subscribed",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mailchimp API error ${res.status}: ${body}`);
  }
}

async function addViaWebhook(email: string): Promise<void> {
  const url = process.env.NEWSLETTER_WEBHOOK_URL!;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "eyra_newsletter_form",
      email,
      subscribed_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Webhook error: ${res.status}`);
}

async function addViaMedusa(email: string): Promise<void> {
  const base = (
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
  ).replace(/\/$/, "");
  const key = process.env.MEDUSA_ADMIN_API_KEY;
  if (!key) throw new Error("MEDUSA_ADMIN_API_KEY not set");

  const headers = { "Content-Type": "application/json", Authorization: `Basic ${key}` };

  // Try to find an existing customer first to avoid duplicates
  const searchRes = await fetch(
    `${base}/admin/customers?email=${encodeURIComponent(email)}&limit=1&fields=id,metadata`,
    // Secret API keys (sk_...) authenticate via HTTP Basic, not this header.
    { headers: { Authorization: `Basic ${key}` }, cache: "no-store" }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json() as {
      customers?: { id: string; metadata?: Record<string, unknown> | null }[];
    };
    const existing = searchData.customers?.[0];
    if (existing) {
      const flag = existing.metadata?.newsletter_subscriber;
      if (flag === true || flag === "true") return;

      // Someone who is already a customer and asks for updates must be put on the
      // list too. Without the tag they would never be sent an offer. Asking again
      // after unsubscribing is a fresh opt-in. The backend sends the welcome offer
      // when it sees the tag appear.
      const tagRes = await fetch(`${base}/admin/customers/${existing.id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          metadata: { newsletter_subscriber: true, subscribed_at: new Date().toISOString(), unsubscribed_at: "" },
        }),
        cache: "no-store",
      });
      if (!tagRes.ok) {
        throw new Error(`Medusa customer update failed ${tagRes.status}: ${await tagRes.text()}`);
      }
      return;
    }
  }

  // Create a guest customer record tagged as newsletter subscriber
  const createRes = await fetch(`${base}/admin/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      metadata: { newsletter_subscriber: true, subscribed_at: new Date().toISOString() },
    }),
    cache: "no-store",
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Medusa customer create failed ${createRes.status}: ${body}`);
  }
}

async function deliverSubscription(email: string): Promise<void> {
  if (process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_LIST_ID) {
    return addToMailchimp(email);
  }
  if (process.env.NEWSLETTER_WEBHOOK_URL) {
    return addViaWebhook(email);
  }
  if (process.env.MEDUSA_ADMIN_API_KEY) {
    return addViaMedusa(email);
  }
  // Development fallback
  console.info("[newsletter/subscribe] No adapter configured. Subscription:", {
    email,
    subscribed_at: new Date().toISOString(),
  });
}

/* ── Route handler ────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, "newsletter_subscribe", 5);
  if (rateLimitResponse) return rateLimitResponse;

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return Response.json({ error: "Email address is required." }, { status: 422 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 422 });
  }

  try {
    await deliverSubscription(email);
  } catch (err) {
    console.error("[newsletter/subscribe] Delivery failed:", err);
    return Response.json(
      { error: "Subscription failed. Please try again." },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}

import type { NextRequest } from "next/server";
import { applyRateLimit } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email";
import { storeConfig } from "@/config/storeConfig";

/* ── Types ────────────────────────────────────────────────── */

interface TicketBody {
  name: string;
  email: string;
  category: string;
  message: string;
}

interface TicketError {
  field: keyof TicketBody | "root";
  message: string;
}

/* ── Server-side validation ───────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const VALID_CATEGORIES = new Set([
  "order", "return", "product", "payment", "custom", "other",
]);

function validateTicket(body: Partial<TicketBody>): TicketError[] {
  const errors: TicketError[] = [];

  // Anything that is not a string is treated as missing.
  for (const key of ["name", "email", "category", "message"] as const) {
    if (typeof body[key] !== "string") delete body[key];
  }

  if (!body.name?.trim()) {
    errors.push({ field: "name", message: "Name is required." });
  } else if (body.name.trim().length < 2) {
    errors.push({ field: "name", message: "Name must be at least 2 characters." });
  } else if (body.name.trim().length > 100) {
    errors.push({ field: "name", message: "Name must be under 100 characters." });
  }

  if (!body.email?.trim()) {
    errors.push({ field: "email", message: "Email address is required." });
  } else if (body.email.trim().length > 254 || !EMAIL_RE.test(body.email.trim().toLowerCase())) {
    errors.push({ field: "email", message: "Please enter a valid email address." });
  }

  if (!body.category) {
    errors.push({ field: "category", message: "Please select a category." });
  } else if (!VALID_CATEGORIES.has(body.category)) {
    errors.push({ field: "category", message: "Invalid category." });
  }

  if (!body.message?.trim()) {
    errors.push({ field: "message", message: "Message is required." });
  } else if (body.message.trim().length < 20) {
    errors.push({
      field: "message",
      message: `Message must be at least 20 characters (${body.message.trim().length}/20).`,
    });
  } else if (body.message.trim().length > 2000) {
    errors.push({ field: "message", message: "Message must be under 2000 characters." });
  }

  return errors;
}

/* ── Delivery adapters ────────────────────────────────────── */

/** Customer text goes into the email as text, never as HTML. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendViaResend(ticket: TicketBody): Promise<void> {
  const recipient =
    process.env.SUPPORT_EMAIL_RECIPIENT ?? storeConfig.contact.supportEmail;
  const name = ticket.name.trim();

  const sent = await sendEmail({
    to: recipient,
    replyTo: ticket.email.trim(),
    from: process.env.SUPPORT_EMAIL_FROM,
    subject: `[Support] ${ticket.category.toUpperCase()}: ${name.replace(/[\r\n]+/g, " ")}`,
    html: `
      <h2>New Support Request</h2>
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> ${esc(ticket.email.trim())}</p>
      <p><strong>Category:</strong> ${esc(ticket.category)}</p>
      <hr />
      <p>${esc(ticket.message.trim()).replace(/\n/g, "<br>")}</p>
    `,
  });

  if (!sent) {
    throw new Error("Resend delivery failed");
  }
}

async function sendViaWebhook(ticket: TicketBody): Promise<void> {
  const url = process.env.SUPPORT_WEBHOOK_URL!;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "eyra_support_form",
      submitted_at: new Date().toISOString(),
      ...ticket,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Webhook delivery failed: ${res.status}`);
}

async function deliverTicket(ticket: TicketBody): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(ticket);
  }
  if (process.env.SUPPORT_WEBHOOK_URL) {
    return sendViaWebhook(ticket);
  }
  // Development fallback, structured log so the data is still visible
  console.info("[support/ticket] No delivery adapter configured. Ticket payload:", {
    name: ticket.name,
    email: ticket.email,
    category: ticket.category,
    message: ticket.message,
    received_at: new Date().toISOString(),
  });
}

/* ── Route handler ────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, "support_ticket", 3);
  if (rateLimitResponse) return rateLimitResponse;

  let body: Partial<TicketBody>;
  try {
    body = (await request.json()) as Partial<TicketBody>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const errors = validateTicket(body);
  if (errors.length > 0) {
    return Response.json({ errors }, { status: 422 });
  }

  const ticket = body as TicketBody;

  try {
    await deliverTicket(ticket);
  } catch (err) {
    console.error("[support/ticket] Delivery failed:", err);
    return Response.json(
      {
        error: `Failed to submit your request. Please try again or email ${storeConfig.contact.supportEmail} directly.`,
      },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}

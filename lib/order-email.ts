/**
 * Server-only: order-confirmation email, sent exactly once per order.
 *
 * Called after every successful cart completion (COD, and both the prepaid
 * verify/webhook paths). Idempotency is tracked via order.metadata since
 * prepaid orders can legitimately be completed by either the fast (verify)
 * or guaranteed (webhook) path, and a rare race between the two could
 * otherwise trigger a duplicate email.
 */
import "server-only";

import { sendEmail } from "@/lib/email";

const BASE_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

const ADMIN_KEY = process.env.MEDUSA_ADMIN_API_KEY ?? "";

interface OrderItemForEmail {
  title: string;
  quantity: number;
  unit_price: number;
  thumbnail: string | null;
}

interface OrderShippingAddress {
  first_name: string | null;
  last_name: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
}

interface OrderForEmail {
  id: string;
  display_id: number;
  email: string | null;
  total: number;
  /** Wallet credit used; `total` is already net of it. */
  credit_line_total?: number;
  metadata: Record<string, unknown> | null;
  items: OrderItemForEmail[];
  shipping_address: OrderShippingAddress | null;
}

function adminHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Basic ${ADMIN_KEY}`,
  };
}

async function fetchOrderForEmail(orderId: string): Promise<OrderForEmail | null> {
  try {
    const fields = [
      "id", "display_id", "email", "total", "credit_line_total", "metadata",
      "items.title", "items.quantity", "items.unit_price", "items.thumbnail",
      "*shipping_address",
    ].join(",");
    const res = await fetch(
      `${BASE_URL}/admin/orders/${orderId}?fields=${fields}`,
      { headers: adminHeaders(), cache: "no-store" }
    );
    if (!res.ok) {
      console.error(`[order-email] order fetch ${res.status}, ${orderId}`);
      return null;
    }
    const data = (await res.json()) as { order?: OrderForEmail };
    return data.order ?? null;
  } catch (err) {
    console.error("[order-email] order fetch failed for", orderId, ":", err);
    return null;
  }
}

async function markConfirmationEmailSent(orderId: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/admin/orders/${orderId}`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ metadata: { confirmation_email_sent: true } }),
    });
  } catch (err) {
    // Non-fatal: worst case is a duplicate email if this order is somehow
    // completed again, which the caller-side idempotency mostly prevents.
    console.error("[order-email] failed to mark sent for", orderId, ":", err);
  }
}

/** EYRA's brand palette (app/globals.css), mirrored here since email clients can't read @theme tokens. */
export const COLOR = {
  jet: "#020202",
  carbon: "#4d4d4d",
  ash: "#626262",
  stone: "#909090",
  cloud: "#ebebeb",
  ivory: "#f9f9f9",
  white: "#ffffff",
};

export const SITE_URL = "https://www.eyra.org.in";

function formatAddress(addr: OrderShippingAddress | null): string {
  if (!addr) return "";
  const name = [addr.first_name, addr.last_name].filter(Boolean).join(" ");
  const line2 = [addr.city, addr.province, addr.postal_code].filter(Boolean).join(", ");
  return [name, addr.address_1, addr.address_2, line2].filter(Boolean).join("<br>");
}

function renderOrderEmail(order: OrderForEmail): string {
  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid ${COLOR.cloud};" width="64">
            ${
              item.thumbnail
                ? `<img src="${item.thumbnail}" width="56" height="56" alt="" style="display:block;border-radius:4px;object-fit:cover;background:${COLOR.cloud};" />`
                : `<div style="width:56px;height:56px;border-radius:4px;background:${COLOR.cloud};"></div>`
            }
          </td>
          <td style="padding:16px 0 16px 16px;border-bottom:1px solid ${COLOR.cloud};font-family:Poppins,Helvetica,Arial,sans-serif;font-size:14px;color:${COLOR.jet};vertical-align:top;">
            ${item.title}
            <div style="color:${COLOR.stone};font-size:13px;margin-top:2px;">Qty ${item.quantity}</div>
          </td>
          <td style="padding:16px 0;border-bottom:1px solid ${COLOR.cloud};font-family:Poppins,Helvetica,Arial,sans-serif;font-size:14px;color:${COLOR.jet};text-align:right;vertical-align:top;white-space:nowrap;">
            ₹${Math.round(item.unit_price * item.quantity).toLocaleString("en-IN")}
          </td>
        </tr>`
    )
    .join("");

  const addressHtml = formatAddress(order.shipping_address);

  return `
  <div style="background:${COLOR.ivory};padding:40px 16px;">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:${COLOR.white};border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:40px 40px 0 40px;text-align:center;">
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:28px;letter-spacing:6px;color:${COLOR.jet};">EYRA</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 40px 0 40px;text-align:center;">
          <div style="width:48px;height:48px;border-radius:50%;background:${COLOR.jet};margin:0 auto 20px auto;line-height:48px;">
            <span style="color:${COLOR.white};font-size:22px;">&#10003;</span>
          </div>
          <div style="font-family:Poppins,Helvetica,Arial,sans-serif;font-weight:500;font-size:20px;color:${COLOR.jet};">Order Confirmed</div>
          <div style="font-family:Poppins,Helvetica,Arial,sans-serif;font-size:14px;color:${COLOR.ash};margin-top:8px;line-height:20px;">
            Thank you for your order. Here's what's on its way.
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 40px 0 40px;">
          <table role="presentation" width="100%" style="border-collapse:collapse;">
            ${rows}
          </table>
          <table role="presentation" width="100%" style="margin-top:16px;font-family:Poppins,Helvetica,Arial,sans-serif;">
            ${
              (order.credit_line_total ?? 0) > 0
                ? `<tr>
              <td style="font-size:14px;color:${COLOR.ash};padding-bottom:6px;">Wallet credit</td>
              <td style="font-size:14px;color:${COLOR.ash};text-align:right;padding-bottom:6px;">- ₹${Math.round(order.credit_line_total ?? 0).toLocaleString("en-IN")}</td>
            </tr>`
                : ""
            }
            <tr>
              <td style="font-size:15px;font-weight:600;color:${COLOR.jet};">Total</td>
              <td style="font-size:15px;font-weight:600;color:${COLOR.jet};text-align:right;">₹${Math.round(order.total).toLocaleString("en-IN")}</td>
            </tr>
          </table>
        </td>
      </tr>
      ${
        addressHtml
          ? `
      <tr>
        <td style="padding:32px 40px 0 40px;">
          <div style="background:${COLOR.ivory};border-radius:12px;padding:16px 20px;font-family:Poppins,Helvetica,Arial,sans-serif;">
            <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${COLOR.stone};margin-bottom:6px;">Shipping to</div>
            <div style="font-size:13px;color:${COLOR.carbon};line-height:20px;">${addressHtml}</div>
          </div>
        </td>
      </tr>`
          : ""
      }
      <tr>
        <td style="padding:32px 40px 40px 40px;text-align:center;">
          <a href="${SITE_URL}/orders" style="display:inline-block;background:${COLOR.jet};color:${COLOR.white};font-family:Poppins,Helvetica,Arial,sans-serif;font-size:14px;font-weight:500;text-decoration:none;padding:14px 32px;border-radius:999px;">
            View Order
          </a>
          <div style="font-family:Poppins,Helvetica,Arial,sans-serif;font-size:12px;color:${COLOR.stone};margin-top:24px;">
            Order #${order.display_id} · Each piece is handcrafted within 7–10 business days.
          </div>
        </td>
      </tr>
    </table>
  </div>
  `;
}

export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  if (!ADMIN_KEY) return;

  const order = await fetchOrderForEmail(orderId);
  if (!order || !order.email) return;
  if (order.metadata?.confirmation_email_sent) return;

  const sent = await sendEmail({
    to: order.email,
    subject: `Your EYRA order #${order.display_id} is confirmed`,
    html: renderOrderEmail(order),
    from: process.env.ORDER_EMAIL_FROM ?? "EYRA Orders <orders@eyra.org.in>",
  });

  if (sent) await markConfirmationEmailSent(orderId);
}

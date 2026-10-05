/**
 * Server-only: emails about the wallet.
 *
 *   - credit added: staff approved a return or exchange, or credit came back
 *     after a cancelled order
 *   - request declined: a return or exchange request was not approved
 *
 * The backend decides when to send these and calls /api/wallet/notify; the
 * look and the sending live here, next to the order emails.
 */
import "server-only";

import { sendEmail } from "@/lib/email";
import { COLOR, SITE_URL } from "@/lib/order-email";
import { formatRupees } from "@/lib/money";

const FONT = "Poppins,Helvetica,Arial,sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shell(content: string): string {
  return `
  <div style="background:${COLOR.ivory};padding:40px 16px;">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:${COLOR.white};border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:40px 40px 0 40px;text-align:center;">
          <div style="font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:28px;letter-spacing:6px;color:${COLOR.jet};">EYRA</div>
        </td>
      </tr>
      ${content}
      <tr>
        <td style="padding:32px 40px 40px 40px;text-align:center;font-family:${FONT};font-size:12px;color:${COLOR.stone};">
          Questions? Reply to this email or visit <a href="${SITE_URL}/support" style="color:${COLOR.stone};">our support page</a>.
        </td>
      </tr>
    </table>
  </div>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${COLOR.jet};color:${COLOR.white};font-family:${FONT};font-size:14px;text-decoration:none;padding:14px 32px;border-radius:999px;">${label}</a>`;
}

function row(label: string, value: string): string {
  return `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${COLOR.cloud};font-family:${FONT};font-size:14px;color:${COLOR.ash};">${label}</td>
              <td style="padding:10px 0;border-bottom:1px solid ${COLOR.cloud};font-family:${FONT};font-size:14px;color:${COLOR.jet};text-align:right;">${value}</td>
            </tr>`;
}

/* ── Credit added ─────────────────────────────────────────── */

export interface WalletCreditEmail {
  email: string;
  firstName?: string | null;
  /** "issued" for an approved return or exchange, "refunded" after a cancelled order. */
  kind: "issued" | "refunded";
  amount: number;
  /** Spendable balance after this credit. */
  balance: number;
  expiresAt: string | null;
  reason: string;
  note: string | null;
}

function creditSentence(params: WalletCreditEmail): string {
  if (params.kind === "refunded") {
    return "Your order was cancelled, so the wallet credit you used on it has been returned.";
  }
  const what = params.reason === "exchange" ? "exchange" : "return";
  return `We have approved your ${what}, and the credit is now in your EYRA wallet.`;
}

export function renderWalletCreditEmail(params: WalletCreditEmail): string {
  const greeting = params.firstName ? `Hi ${escapeHtml(params.firstName)},` : "Hello,";

  return shell(`
      <tr>
        <td style="padding:32px 40px 0 40px;text-align:center;">
          <div style="font-family:${FONT};font-size:22px;font-weight:500;color:${COLOR.jet};">${formatRupees(params.amount)} added to your wallet</div>
          <div style="font-family:${FONT};font-size:14px;color:${COLOR.ash};margin-top:12px;line-height:22px;">
            ${greeting}<br>${escapeHtml(creditSentence(params))}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 40px 0 40px;">
          <table role="presentation" width="100%" style="border-collapse:collapse;">
            ${row("Credit added", formatRupees(params.amount))}
            ${row("Wallet balance", formatRupees(params.balance))}
            ${params.expiresAt ? row("Valid until", escapeHtml(formatLongDate(params.expiresAt))) : ""}
          </table>
          ${
            params.note
              ? `<div style="font-family:${FONT};font-size:13px;color:${COLOR.ash};margin-top:16px;line-height:20px;"><strong style="color:${COLOR.jet};">Note from our team:</strong> ${escapeHtml(params.note)}</div>`
              : ""
          }
        </td>
      </tr>
      <tr>
        <td style="padding:28px 40px 0 40px;text-align:center;">
          ${button(`${SITE_URL}/wallet`, "View your wallet")}
          <div style="font-family:${FONT};font-size:12px;color:${COLOR.stone};margin-top:16px;line-height:18px;">
            Switch on wallet credit on the payment step at checkout. Credit that expires first is used first.
          </div>
        </td>
      </tr>`);
}

export async function sendWalletCreditEmail(params: WalletCreditEmail): Promise<boolean> {
  return sendEmail({
    to: params.email,
    from: process.env.ORDER_EMAIL_FROM ?? "EYRA <noreply@eyra.org.in>",
    subject: `${formatRupees(params.amount)} has been added to your EYRA wallet`,
    html: renderWalletCreditEmail(params),
  });
}

/* ── Request declined ─────────────────────────────────────── */

export interface RequestRejectedEmail {
  email: string;
  firstName?: string | null;
  requestType: "return" | "exchange";
  orderNumber: number | null;
  /** Why it was declined, written by our team. */
  note: string;
}

export function renderRequestRejectedEmail(params: RequestRejectedEmail): string {
  const greeting = params.firstName ? `Hi ${escapeHtml(params.firstName)},` : "Hello,";
  const order = params.orderNumber ? ` for order #${params.orderNumber}` : "";

  return shell(`
      <tr>
        <td style="padding:32px 40px 0 40px;text-align:center;">
          <div style="font-family:${FONT};font-size:22px;font-weight:500;color:${COLOR.jet};">About your ${params.requestType} request</div>
          <div style="font-family:${FONT};font-size:14px;color:${COLOR.ash};margin-top:12px;line-height:22px;">
            ${greeting}<br>We looked at your ${params.requestType} request${order} and were not able to approve it.
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 40px 0 40px;">
          <div style="background:${COLOR.ivory};border-radius:12px;padding:16px 20px;font-family:${FONT};font-size:14px;color:${COLOR.jet};line-height:22px;">
            ${escapeHtml(params.note)}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 40px 0 40px;text-align:center;">
          ${button(`${SITE_URL}/support`, "Talk to our team")}
          <div style="font-family:${FONT};font-size:12px;color:${COLOR.stone};margin-top:16px;line-height:18px;">
            If you think we have got this wrong, tell us and we will take another look.
          </div>
        </td>
      </tr>`);
}

export async function sendRequestRejectedEmail(params: RequestRejectedEmail): Promise<boolean> {
  return sendEmail({
    to: params.email,
    from: process.env.ORDER_EMAIL_FROM ?? "EYRA <noreply@eyra.org.in>",
    subject: `An update on your ${params.requestType} request`,
    html: renderRequestRejectedEmail(params),
  });
}

/* ── New request: alert for our team ──────────────────────── */

export interface ReturnRequestAlert {
  customerName: string;
  customerEmail: string;
  orderNumber: number;
  type: "return" | "exchange";
  reason: string;
  note: string | null;
  items: { title: string; quantity: number; total: number }[];
  itemsTotal: number;
  deliveryUnconfirmed: boolean;
}

/** Tells our support inbox a customer asked for a return or exchange. */
export async function sendReturnRequestAlertEmail(alert: ReturnRequestAlert): Promise<boolean> {
  const adminUrl = `${(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000").replace(/\/$/, "")}/app/return-requests`;
  const items = alert.items
    .map((item) => `<li>${item.quantity} x ${escapeHtml(item.title)} (${formatRupees(item.total)})</li>`)
    .join("");

  return sendEmail({
    to: process.env.SUPPORT_EMAIL_RECIPIENT ?? "support@eyra.org.in",
    replyTo: alert.customerEmail,
    from: process.env.SUPPORT_EMAIL_FROM,
    subject: `[${alert.type === "exchange" ? "Exchange" : "Return"} request] Order #${alert.orderNumber} from ${alert.customerName}`,
    html: `
      <h2>New ${alert.type} request</h2>
      <p><strong>Customer:</strong> ${escapeHtml(alert.customerName)} (${escapeHtml(alert.customerEmail)})</p>
      <p><strong>Order:</strong> #${alert.orderNumber}</p>
      <p><strong>Reason:</strong> ${escapeHtml(alert.reason)}</p>
      ${alert.note ? `<p><strong>Their note:</strong> ${escapeHtml(alert.note)}</p>` : ""}
      <p><strong>Items (${formatRupees(alert.itemsTotal)}):</strong></p>
      <ul>${items}</ul>
      ${alert.deliveryUnconfirmed ? "<p><em>We could not confirm the delivery date automatically. Please check it before approving.</em></p>" : ""}
      <p><a href="${adminUrl}">Review it in the admin (Returns)</a></p>
    `,
  });
}

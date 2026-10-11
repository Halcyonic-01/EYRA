/**
 * Server-only: emails about the wallet.
 *
 *   - credit added: staff approved a return or exchange, or credit came back
 *     after a cancelled order
 *   - request declined: a return or exchange request was not approved
 *   - order cancelled: the customer cancelled, and what was refunded where
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

/* ── Order cancelled ──────────────────────────────────────── */

export interface OrderCancelledEmail {
  email: string;
  firstName?: string | null;
  orderNumber: number;
  method: "wallet" | "original" | "none";
  paidOnline: number;
  walletUsed: number;
  fee: number;
  refundAmount: number;
  refundStatus: "not_needed" | "initiated" | "credited" | "failed" | "unverified";
  /** How long a refund to the original payment method takes. */
  eta: string;
  walletExpiresAt: string | null;
  validMonths: number;
}

function cancelledContent(params: OrderCancelledEmail): { headline: string; intro: string; rows: string } {
  const orderRef = `#${params.orderNumber}`;
  const walletUsedRow = params.walletUsed > 0 ? row("Wallet credit you used", `${formatRupees(params.walletUsed)} returned`) : "";

  // The refund could not be completed yet; the order is still cancelled.
  if (params.refundStatus === "failed") {
    return {
      headline: `Order ${orderRef} is cancelled`,
      intro:
        "We are finishing your refund and will email you as soon as it is done. You do not need to do anything.",
      rows: `${row("Paid online", formatRupees(params.paidOnline))}${walletUsedRow}`,
    };
  }

  if (params.method === "wallet") {
    return {
      headline: `${formatRupees(params.refundAmount)} added to your wallet`,
      intro: `Your order ${orderRef} has been cancelled, and the full amount you paid is now in your EYRA wallet.`,
      rows: `
            ${row("Paid online", formatRupees(params.paidOnline))}
            ${row("Added to your wallet", `${formatRupees(params.refundAmount)} (100%)`)}
            ${walletUsedRow}
            ${params.walletExpiresAt ? row("Valid until", escapeHtml(formatLongDate(params.walletExpiresAt))) : row("Valid for", `${params.validMonths} months`)}`,
    };
  }

  if (params.method === "original") {
    return {
      headline: `Refund of ${formatRupees(params.refundAmount)} started`,
      intro: `Your order ${orderRef} has been cancelled, and we have sent your refund to the payment method you used.`,
      rows: `
            ${row("Paid online", formatRupees(params.paidOnline))}
            ${row("Cancellation fee", `- ${formatRupees(params.fee)}`)}
            ${row("Refund to your original payment method", formatRupees(params.refundAmount))}
            ${walletUsedRow}
            ${row("Expected in", escapeHtml(params.eta))}`,
    };
  }

  return {
    headline: `Order ${orderRef} is cancelled`,
    intro:
      params.walletUsed > 0
        ? "Your order has been cancelled, and the wallet credit you used on it has been returned to your EYRA wallet. No other payment was taken."
        : "Your order has been cancelled. No payment was taken, so there is nothing to refund.",
    rows: walletUsedRow,
  };
}

export function renderOrderCancelledEmail(params: OrderCancelledEmail): string {
  const greeting = params.firstName ? `Hi ${escapeHtml(params.firstName)},` : "Hello,";
  const { headline, intro, rows } = cancelledContent(params);
  // Not the wallet button while the wallet refund itself is still being finished.
  const toWallet = (params.method === "wallet" && params.refundStatus !== "failed") || params.walletUsed > 0;

  return shell(`
      <tr>
        <td style="padding:32px 40px 0 40px;text-align:center;">
          <div style="font-family:${FONT};font-size:22px;font-weight:500;color:${COLOR.jet};">${escapeHtml(headline)}</div>
          <div style="font-family:${FONT};font-size:14px;color:${COLOR.ash};margin-top:12px;line-height:22px;">
            ${greeting}<br>${escapeHtml(intro)}
          </div>
        </td>
      </tr>
      ${
        rows.trim()
          ? `<tr>
        <td style="padding:24px 40px 0 40px;">
          <table role="presentation" width="100%" style="border-collapse:collapse;">${rows}</table>
        </td>
      </tr>`
          : ""
      }
      <tr>
        <td style="padding:28px 40px 0 40px;text-align:center;">
          ${button(toWallet ? `${SITE_URL}/wallet` : `${SITE_URL}/orders`, toWallet ? "View your wallet" : "View your orders")}
        </td>
      </tr>`);
}

export async function sendOrderCancelledEmail(params: OrderCancelledEmail): Promise<boolean> {
  return sendEmail({
    to: params.email,
    from: process.env.ORDER_EMAIL_FROM ?? "EYRA <noreply@eyra.org.in>",
    subject: `Your EYRA order #${params.orderNumber} has been cancelled`,
    html: renderOrderCancelledEmail(params),
  });
}

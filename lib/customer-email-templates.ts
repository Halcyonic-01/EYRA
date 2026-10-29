/**
 * What customers read: order updates, refunds and offers.
 *
 * Each renderer returns the subject and the HTML, and nothing here sends
 * anything, so the wording can be tested and previewed on its own. The senders
 * are in lib/customer-email.ts. Every value that came from outside is escaped.
 */
import { EXCHANGE_WINDOW_DAYS, RETURN_WINDOW_DAYS } from "@/config/policy-constants";
import { COLOR, FONT, SITE_URL, button, escapeHtml, heading, row, shell } from "@/lib/email-layout";
import { formatRupees } from "@/lib/money";

export interface Rendered {
  subject: string;
  html: string;
}

const hello = (firstName?: string | null): string => (firstName ? `Hi ${escapeHtml(firstName)},` : "Hello,");

const orderLink = (orderId: string): string => `${SITE_URL}/orders/${encodeURIComponent(orderId)}`;

const note = (text: string): string => `
      <tr>
        <td style="padding:20px 40px 0 40px;text-align:center;font-family:${FONT};font-size:12px;color:${COLOR.stone};line-height:18px;">${text}</td>
      </tr>`;

const cta = (href: string, label: string): string => `
      <tr>
        <td style="padding:28px 40px 0 40px;text-align:center;">${button(href, label)}</td>
      </tr>`;

const details = (rows: string): string => `
      <tr>
        <td style="padding:24px 40px 0 40px;">
          <table role="presentation" width="100%" style="border-collapse:collapse;">${rows}</table>
        </td>
      </tr>`;

/* ── Order updates ────────────────────────────────────────── */

export interface OrderShippedEmail {
  firstName?: string | null;
  orderNumber: number;
  orderId: string;
  awb: string | null;
  courier: string | null;
}

export function renderOrderShipped(params: OrderShippedEmail): Rendered {
  return {
    subject: `Your EYRA order #${params.orderNumber} is on its way`,
    html: shell(
      heading(
        "Your order has shipped",
        `${hello(params.firstName)}<br>Order #${params.orderNumber} has been handed to the courier. You can follow it from your order page.`
      ) +
        details(
          row("Order", `#${params.orderNumber}`) +
            (params.courier ? row("Courier", escapeHtml(params.courier)) : "") +
            (params.awb ? row("Tracking number", escapeHtml(params.awb)) : "")
        ) +
        cta(orderLink(params.orderId), "Track your order")
    ),
  };
}

export interface OrderDeliveredEmail {
  firstName?: string | null;
  orderNumber: number;
  orderId: string;
}

export function renderOrderDelivered(params: OrderDeliveredEmail): Rendered {
  return {
    subject: `Your EYRA order #${params.orderNumber} has been delivered`,
    html: shell(
      heading(
        "Delivered",
        `${hello(params.firstName)}<br>Order #${params.orderNumber} has been delivered. We hope you love it.`
      ) +
        cta(orderLink(params.orderId), "View your order") +
        note(
          `Not quite right? You can ask for a return within ${RETURN_WINDOW_DAYS} days, or an exchange within ${EXCHANGE_WINDOW_DAYS} days, from your order page.`
        )
    ),
  };
}

/* ── Refunds ──────────────────────────────────────────────── */

export interface RefundProcessedEmail {
  firstName?: string | null;
  orderNumber: number;
  amount: number;
  /** Why the money is coming back, in a short phrase: "your parcel was returned to us". */
  reason: string;
  /** Credit note number, when one was issued. */
  creditNote: string | null;
  eta: string;
}

export function renderRefundProcessed(params: RefundProcessedEmail): Rendered {
  return {
    subject: `Your refund of ${formatRupees(params.amount)} for order #${params.orderNumber}`,
    html: shell(
      heading(
        `${formatRupees(params.amount)} is being refunded`,
        `${hello(params.firstName)}<br>We have started your refund for order #${params.orderNumber} because ${escapeHtml(params.reason)}. It goes back to the payment method you used.`
      ) +
        details(
          row("Refund amount", formatRupees(params.amount)) +
            row("Expected in", escapeHtml(params.eta)) +
            (params.creditNote ? row("Credit note", escapeHtml(params.creditNote)) : "")
        ) +
        cta(`${SITE_URL}/orders`, "View your orders")
    ),
  };
}

/* ── Offers ───────────────────────────────────────────────── */

const unsubscribeLine = (url: string): string =>
  `You are getting this because you signed up for EYRA updates. <a href="${escapeHtml(url)}" style="color:${COLOR.stone};">Unsubscribe</a>.`;

function codeBlock(code: string, amount: number, minOrder: number | null): string {
  return `
      <tr>
        <td style="padding:24px 40px 0 40px;text-align:center;">
          <div style="display:inline-block;border:1px dashed ${COLOR.stone};border-radius:12px;padding:16px 32px;">
            <div style="font-family:${FONT};font-size:12px;letter-spacing:2px;color:${COLOR.stone};">YOUR CODE</div>
            <div style="font-family:${FONT};font-size:24px;font-weight:500;letter-spacing:3px;color:${COLOR.jet};margin-top:4px;">${escapeHtml(code)}</div>
            <div style="font-family:${FONT};font-size:13px;color:${COLOR.ash};margin-top:6px;">${formatRupees(amount)} off${minOrder !== null ? ` orders above ${formatRupees(minOrder)}` : ""}</div>
          </div>
        </td>
      </tr>`;
}

export interface WelcomeOfferEmail {
  firstName?: string | null;
  code: string;
  amount: number;
  minOrder: number;
  unsubscribeUrl: string;
}

export function renderWelcomeOffer(params: WelcomeOfferEmail): Rendered {
  return {
    subject: `Welcome to EYRA: ${formatRupees(params.amount)} off your first order`,
    html: shell(
      heading(
        "Welcome to EYRA",
        `${hello(params.firstName)}<br>Thank you for joining us. Here is ${formatRupees(params.amount)} off your first order.`
      ) +
        codeBlock(params.code, params.amount, params.minOrder) +
        cta(`${SITE_URL}/products`, "Shop now") +
        note("Sign in and enter the code at checkout. It can be used once per account."),
      unsubscribeLine(params.unsubscribeUrl)
    ),
  };
}

export interface PromotionEmail {
  firstName?: string | null;
  subject: string;
  headline: string;
  message: string;
  /** An offer to show, if the email carries one. */
  offer?: { code: string; amount: number; minOrder: number | null } | null;
  ctaLabel: string;
  ctaUrl: string;
  unsubscribeUrl: string;
}

export function renderPromotion(params: PromotionEmail): Rendered {
  return {
    subject: params.subject,
    html: shell(
      heading(escapeHtml(params.headline), `${hello(params.firstName)}<br>${escapeHtml(params.message)}`) +
        (params.offer ? codeBlock(params.offer.code, params.offer.amount, params.offer.minOrder) : "") +
        cta(escapeHtml(params.ctaUrl), escapeHtml(params.ctaLabel)),
      unsubscribeLine(params.unsubscribeUrl)
    ),
  };
}

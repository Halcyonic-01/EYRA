/**
 * Server-only: sends the order-update, refund and offer emails.
 *
 * The backend decides when each one goes out (and makes sure it goes out once)
 * and calls /api/wallet/notify. The wording is in lib/customer-email-templates.ts.
 * Each key below is also sent to Resend as an idempotency key, so a repeated
 * request within 24 hours cannot produce a second email.
 */
import "server-only";

import { sendEmail } from "@/lib/email";
import {
  renderOrderDelivered,
  renderOrderShipped,
  renderPromotion,
  renderRefundProcessed,
  renderWelcomeOffer,
  type OrderDeliveredEmail,
  type OrderShippedEmail,
  type PromotionEmail,
  type RefundProcessedEmail,
  type Rendered,
  type WelcomeOfferEmail,
} from "@/lib/customer-email-templates";
import { unsubscribeUrl } from "@/lib/unsubscribe-token";

const FROM_ORDERS = () => process.env.ORDER_EMAIL_FROM ?? "EYRA Orders <orders@eyra.org.in>";
const FROM_OFFERS = () => process.env.ORDER_EMAIL_FROM ?? "EYRA <noreply@eyra.org.in>";

type Common = { email: string; idempotencyKey?: string | null };

function transactional(to: Common, rendered: Rendered): Promise<boolean> {
  return sendEmail({
    to: to.email,
    from: FROM_ORDERS(),
    subject: rendered.subject,
    html: rendered.html,
    category: "transactional",
    idempotencyKey: to.idempotencyKey ?? undefined,
  });
}

export const sendOrderShippedEmail = (p: Common & OrderShippedEmail) => transactional(p, renderOrderShipped(p));

export const sendOrderDeliveredEmail = (p: Common & OrderDeliveredEmail) => transactional(p, renderOrderDelivered(p));

export const sendRefundProcessedEmail = (p: Common & RefundProcessedEmail) => transactional(p, renderRefundProcessed(p));

/**
 * Offers are promotional: no unsubscribe link means no email, so a missing
 * secret can never lead to a mail that cannot be opted out of.
 */
async function promotional(
  to: Common,
  render: (unsubscribe: string) => Rendered
): Promise<boolean> {
  const unsubscribe = unsubscribeUrl(to.email);
  if (!unsubscribe) {
    console.error("[email] promotional email not sent: no unsubscribe secret is set");
    return false;
  }
  const rendered = render(unsubscribe);
  return sendEmail({
    to: to.email,
    from: FROM_OFFERS(),
    subject: rendered.subject,
    html: rendered.html,
    category: "promotional",
    idempotencyKey: to.idempotencyKey ?? undefined,
    unsubscribeUrl: unsubscribe,
  });
}

export const sendWelcomeOfferEmail = (p: Common & Omit<WelcomeOfferEmail, "unsubscribeUrl">) =>
  promotional(p, (unsubscribeUrl) => renderWelcomeOffer({ ...p, unsubscribeUrl }));

export const sendPromotionEmail = (p: Common & Omit<PromotionEmail, "unsubscribeUrl">) =>
  promotional(p, (unsubscribeUrl) => renderPromotion({ ...p, unsubscribeUrl }));

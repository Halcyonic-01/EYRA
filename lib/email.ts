/**
 * Server-only: shared Resend email sending.
 *
 * Env vars:
 *   RESEND_API_KEY            from https://resend.com/api-keys
 *   ORDER_EMAIL_FROM          optional sender, defaults below
 *   EMAIL_MODE                live | test | off (see lib/email-delivery.ts)
 *   EMAIL_TEST_RECIPIENT      where every email goes in test mode
 *   EMAIL_PROMOTIONS_ENABLED  true to allow promotional email in live mode
 *
 * Sending never throws: a failed email returns false and is logged, so it can
 * never break checkout or an order update. The work is in lib/resend-send.ts.
 */
import "server-only";

import { sendThroughResend, type EmailParams } from "@/lib/resend-send";

export async function sendEmail(params: EmailParams): Promise<boolean> {
  return sendThroughResend(params, process.env);
}

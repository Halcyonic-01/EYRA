/**
 * Signed unsubscribe links for promotional email. The token proves the link was
 * made by us for that address, so nobody can unsubscribe someone else by
 * guessing a URL. Free of server-only code so it can be tested on its own.
 *
 * Signed with EMAIL_UNSUBSCRIBE_SECRET, or STOREFRONT_REVALIDATE_SECRET when that
 * is not set. With neither there is no link, and promotional email is not sent.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { SITE_URL } from "@/lib/email-layout";

type Env = Record<string, string | undefined>;

const secretFrom = (env: Env): string | null =>
  env.EMAIL_UNSUBSCRIBE_SECRET?.trim() || env.STOREFRONT_REVALIDATE_SECRET?.trim() || null;

const normalise = (email: string): string => email.trim().toLowerCase();

export function signUnsubscribe(email: string, env: Env = process.env): string | null {
  const secret = secretFrom(env);
  if (!secret) return null;
  return createHmac("sha256", secret).update(`unsubscribe:${normalise(email)}`).digest("hex");
}

export function verifyUnsubscribe(email: string, token: string, env: Env = process.env): boolean {
  const expected = signUnsubscribe(email, env);
  if (!expected || !token) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(email: string, env: Env = process.env): string | null {
  const token = signUnsubscribe(email, env);
  if (!token) return null;
  return `${SITE_URL}/api/newsletter/unsubscribe?e=${encodeURIComponent(normalise(email))}&t=${token}`;
}

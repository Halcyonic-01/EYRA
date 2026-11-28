/**
 * Analytics consent: the customer's own choice, asked before PostHog runs.
 *
 * Kept in a first-party cookie (strictly necessary: it only remembers the
 * choice) so the choice holds across visits. The cookie carries the status,
 * when it was given and the version of the notice it was given for. A
 * missing, unreadable or older-version cookie means "not asked yet", which
 * is treated exactly like "declined": PostHog does not load.
 *
 * Pure parsing here; the browser parts are in client.ts.
 */

export type ConsentStatus = "granted" | "denied";

export type Consent = {
  status: ConsentStatus;
  /** When the choice was made, ISO 8601. */
  at: string;
  /** The version of the consent notice; a new version asks again. */
  version: number;
};

export const CONSENT_COOKIE = "eyra_analytics_consent";
/** Raise when what analytics collects changes: everyone is asked again. */
export const CONSENT_VERSION = 1;
/** The choice is remembered for a year, then asked again. */
export const CONSENT_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** "granted.1.2026-11-28T10:00:00.000Z" */
export function encodeConsent(consent: Consent): string {
  return `${consent.status}.${consent.version}.${consent.at}`;
}

export function parseConsent(value: string | null | undefined): Consent | null {
  if (!value) return null;
  const match = /^(granted|denied)\.(\d+)\.(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)$/.exec(decodeURIComponent(value));
  if (!match) return null;
  const version = Number(match[2]);
  const at = new Date(match[3]);
  if (version !== CONSENT_VERSION || Number.isNaN(at.getTime())) return null;
  return { status: match[1] as ConsentStatus, version, at: at.toISOString() };
}

/** The consent cookie's value from a Cookie header or document.cookie. */
export function consentFromCookieHeader(header: string | null | undefined): Consent | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CONSENT_COOKIE) return parseConsent(rest.join("="));
  }
  return null;
}

/** Only an explicit, current "granted" allows analytics. */
export function analyticsAllowed(consent: Consent | null): boolean {
  return consent?.status === "granted";
}

/** Names PostHog stores under (cookies, localStorage, sessionStorage): removed on withdrawal. */
export function isPosthogStorageKey(name: string): boolean {
  return name.startsWith("ph_") || name.startsWith("__ph_") || name.startsWith("__posthog");
}

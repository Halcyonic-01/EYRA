/**
 * The storefront's only way to talk to PostHog. Components call track(),
 * identifyCustomer() and resetIdentity(); nothing else imports posthog-js.
 *
 * - Consent first (lib/analytics/consent.ts): posthog-js is not downloaded,
 *   started or sent anything until the customer accepts analytics. Before
 *   that, and after a "no", every call is dropped (not queued), so nothing
 *   from before the choice is ever sent.
 * - Off unless configured (lib/analytics/config.ts).
 * - posthog-js is loaded lazily, so it never delays the first paint.
 * - Nothing here can break the shop: every call is wrapped, and a failure to
 *   load or send is dropped silently.
 */

import type { PostHog } from "posthog-js";

import { ANALYTICS_PATH, analyticsConfig } from "@/lib/analytics/config";
import {
  analyticsAllowed,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_VERSION,
  consentFromCookieHeader,
  encodeConsent,
  isPosthogStorageKey,
  type Consent,
  type ConsentStatus,
} from "@/lib/analytics/consent";
import type { AnalyticsEventName, AnalyticsEvents } from "@/lib/analytics/events";
import { beforeSend, recordingAllowed } from "@/lib/analytics/privacy";

// Read literally so Next inlines them into the browser bundle.
const config = analyticsConfig({
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_POSTHOG_REPLAY: process.env.NEXT_PUBLIC_POSTHOG_REPLAY,
  NEXT_PUBLIC_POSTHOG_DEBUG: process.env.NEXT_PUBLIC_POSTHOG_DEBUG,
});

/** Only ids of this shape are used as a person's id: the Medusa customer id. */
const CUSTOMER_ID = /^cus_[A-Za-z0-9]{10,}$/;
const MAX_QUEUED = 50;

let client: PostHog | null = null;
let started = false;
const queue: ((posthog: PostHog) => void)[] = [];

export function analyticsEnabled(): boolean {
  return config !== null;
}

function run(action: (posthog: PostHog) => void) {
  if (!config || typeof window === "undefined") return;
  // Starts PostHog on first use if the customer has accepted; whichever component tracks first.
  if (!started) initAnalytics();
  // Not started means no consent: dropped, never queued for later.
  if (!started) return;
  if (!client) {
    if (queue.length < MAX_QUEUED) queue.push(action);
    return;
  }
  try {
    action(client);
  } catch {
    // Analytics must never affect the shop.
  }
}

/** Called when the app mounts (AnalyticsBridge), on first use, and when the customer accepts. Starts only with consent. */
export function initAnalytics() {
  if (!config || started || typeof window === "undefined") return;
  if (!analyticsAllowed(readConsent())) return;
  started = true;
  import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(config.key, {
        api_host: ANALYTICS_PATH,
        ui_host: config.uiHost,
        defaults: "2026-08-30",
        // Only signed-in customers get a person profile; visitors stay anonymous.
        person_profiles: "identified_only",
        // Explicit events only: autocapture records click text and adds noise and cost.
        autocapture: false,
        capture_dead_clicks: false,
        // Errors already go to Sentry.
        capture_exceptions: false,
        // Started per page by applyRecordingRules, never before the page is checked.
        disable_session_recording: true,
        session_recording: {
          maskAllInputs: true,
          // Elements marked data-ph-mask (and their children) show as masked text.
          maskTextSelector: "[data-ph-mask]",
        },
        before_send: beforeSend,
        debug: config.debug,
      });
      client = posthog;
      for (const action of queue.splice(0)) run(action);
    })
    .catch(() => {
      // Blocked or offline: analytics stays off for this visit.
      queue.length = 0;
    });
}

/** One product-analytics event, as defined in lib/analytics/events.ts. */
export function track<E extends AnalyticsEventName>(event: E, properties: AnalyticsEvents[E]) {
  run((posthog) => posthog.capture(event, properties));
}

/**
 * A signed-in customer. Their id is the Medusa customer id (pseudonymous,
 * also known to the backend, which sends order events under it). The visitor's
 * anonymous history is merged into it by PostHog. No person properties are set.
 */
export function identifyCustomer(customerId: string) {
  if (!CUSTOMER_ID.test(customerId)) return;
  run((posthog) => {
    if (posthog.get_distinct_id() !== customerId) posthog.identify(customerId);
  });
}

/** Signed out: the next person on this device starts anonymous. Only after an identified session. */
export function resetIdentity() {
  run((posthog) => {
    if (posthog.get_property("$user_state") === "identified") posthog.reset();
  });
}

/** Session replay runs only where it is allowed (lib/analytics/privacy.ts) and only when configured. */
export function applyRecordingRules(pathname: string) {
  if (!config?.replay) return;
  run((posthog) => {
    const allowed = recordingAllowed(pathname);
    const recording = posthog.sessionRecordingStarted();
    if (allowed && !recording) posthog.startSessionRecording();
    if (!allowed && recording) posthog.stopSessionRecording();
  });
}

// ── Consent ──────────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
const CHANNEL = "eyra-analytics-consent";

/** The choice on this device, or null when not asked yet. */
export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  return consentFromCookieHeader(document.cookie);
}

/** For the banner: re-render when the choice changes. */
export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}

function writeConsentCookie(consent: Consent) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(encodeConsent(consent))}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

/** Tells the backend (for a signed-in customer), so server-side order events follow the same choice. */
export async function syncConsent(consent: Consent): Promise<boolean> {
  try {
    const res = await fetch("/api/analytics/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(consent),
      keepalive: true,
    });
    // Stored only for a signed-in customer; a visitor's choice is sent again after sign-in.
    if (!res.ok) return false;
    const body = (await res.json().catch(() => ({}))) as { stored?: unknown };
    return body.stored === true;
  } catch {
    return false;
  }
}

/** Deletes everything PostHog stored on this device: its cookies (on this host and the parent domain) and storage. */
function clearPosthogStorage() {
  const host = window.location.hostname;
  const domains = ["", `; Domain=${host}`, `; Domain=.${host.split(".").slice(-2).join(".")}`];
  for (const part of document.cookie.split(";")) {
    const name = part.trim().split("=")[0];
    if (!name || !isPosthogStorageKey(name)) continue;
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
  }
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      for (const key of Object.keys(storage)) if (isPosthogStorageKey(key)) storage.removeItem(key);
    } catch {
      // Storage blocked: nothing was stored there either.
    }
  }
}

/** Stops PostHog on this page and removes what it stored. A reload follows, so no PostHog code keeps running. */
function stopAnalytics() {
  try {
    client?.stopSessionRecording();
    client?.opt_out_capturing();
    // No writing back: PostHog saves its state again as the page unloads, and
    // reset() would store a new anonymous id. With persistence off, removing
    // the storage below is the reset.
    client?.set_config({ disable_persistence: true, disable_session_recording: true });
  } catch {
    // Already stopped.
  }
  queue.length = 0;
  clearPosthogStorage();
}

/**
 * The customer's choice. "granted" starts PostHog now. "denied" before
 * PostHog ran stores the choice; after it ran (a withdrawal), PostHog is
 * stopped, its identity and storage are removed, and the page reloads.
 */
export function setConsent(status: ConsentStatus) {
  if (typeof window === "undefined") return;
  const consent: Consent = { status, at: new Date().toISOString(), version: CONSENT_VERSION };
  writeConsentCookie(consent);
  void syncConsent(consent).then((ok) => rememberSynced(consent, ok));
  try {
    new BroadcastChannel(CHANNEL).postMessage(status);
  } catch {
    // Old browsers: other tabs follow on their next page load.
  }
  if (status === "granted") {
    initAnalytics();
    notify();
    return;
  }
  const wasRunning = started;
  stopAnalytics();
  notify();
  if (wasRunning) window.location.reload();
}

/** Another tab changed the choice: follow it. */
export function followConsentInOtherTabs() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (message) => {
    if (message.data === "granted") initAnalytics();
    else if (started) {
      stopAnalytics();
      window.location.reload();
    }
    notify();
  };
}

const SYNCED_KEY = "eyra_analytics_consent_synced";

function rememberSynced(consent: Consent, ok: boolean) {
  try {
    if (ok) window.sessionStorage.setItem(SYNCED_KEY, encodeConsent(consent));
  } catch {
    // Storage blocked: it is sent again next time.
  }
}

/** Signed in: make sure the backend has this device's choice (once per visit, retried until it succeeds). */
export function syncConsentOnce() {
  const consent = readConsent();
  if (!consent) return;
  try {
    if (window.sessionStorage.getItem(SYNCED_KEY) === encodeConsent(consent)) return;
  } catch {
    // Storage blocked: send it.
  }
  void syncConsent(consent).then((ok) => rememberSynced(consent, ok));
}

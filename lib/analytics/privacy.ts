/**
 * What leaves the browser, cleaned. Pure, so it is tested without a browser.
 *
 * PostHog adds page URLs to every event on its own. EYRA's URLs can carry
 * things that must not go to analytics: review links hold a private token in
 * the path, and query strings carry order and payment references. So every
 * URL property keeps only the path (tokens replaced) and campaign tags.
 * Person properties are never set, and any property named like personal data
 * is dropped as a last line of defence.
 */

import type { CaptureResult } from "posthog-js";

/** Path segments that are private tokens: /review/<token>. */
const TOKEN_PATHS: RegExp[] = [/^(\/review\/)[^/]+/];

/** Campaign tags are the only query parameters kept. */
const KEPT_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);

const URL_PROPERTIES = [
  "$current_url",
  "$referrer",
  "$initial_current_url",
  "$initial_referrer",
  "$prev_pageview_url",
  "$session_entry_url",
  "$session_entry_referrer",
];
const PATH_PROPERTIES = ["$pathname", "$prev_pageview_pathname", "$initial_pathname", "$session_entry_pathname"];

/** Names that would hold personal data. None of EYRA's events use them. (Private tokens only ever appear in URLs, cleaned above.) */
const PERSONAL = /(^|_)(email|phone|mobile|name|first_?name|last_?name|address|pincode|postal|city|password)($|_)/i;

/** PostHog's own properties without a "$": always kept (token is the project key, required to ingest). */
const POSTHOG_KEYS = new Set(["token", "distinct_id"]);

export function cleanPath(path: string): string {
  let out = path;
  for (const pattern of TOKEN_PATHS) out = out.replace(pattern, "$1[token]");
  return out;
}

/** The URL with its path cleaned, only campaign tags in the query, and no fragment. Unparseable values are dropped. */
export function cleanUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const kept = new URLSearchParams();
  url.searchParams.forEach((v, k) => {
    if (KEPT_PARAMS.has(k)) kept.set(k, v);
  });
  const query = kept.toString();
  return `${url.origin}${cleanPath(url.pathname)}${query ? `?${query}` : ""}`;
}

function cleanProperties(props: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!props) return props;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!key.startsWith("$") && !POSTHOG_KEYS.has(key) && PERSONAL.test(key)) continue;
    if (URL_PROPERTIES.includes(key) && typeof value === "string") {
      const cleaned = cleanUrl(value);
      if (cleaned !== null) out[key] = cleaned;
      continue;
    }
    out[key] = PATH_PROPERTIES.includes(key) && typeof value === "string" ? cleanPath(value) : value;
  }
  return out;
}

/** PostHog's before_send: every event passes through here. */
export function beforeSend(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  return {
    ...event,
    properties: cleanProperties(event.properties) ?? {},
    // Person properties are not used: a person is only a pseudonymous customer id.
    $set: cleanProperties(event.$set),
    $set_once: cleanProperties(event.$set_once),
  };
}

/**
 * Pages never recorded by session replay: the customer's own data (account,
 * orders, wallet, addresses), sign-in, and private review links. Inputs are
 * masked everywhere else; these pages show personal data as plain text.
 */
const NOT_RECORDED = ["/account", "/orders", "/wallet", "/sign-in", "/sign-up", "/review", "/support", "/contact"];

export function recordingAllowed(pathname: string): boolean {
  return !NOT_RECORDED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

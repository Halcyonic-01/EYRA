/**
 * Shared Sentry settings for the browser, the Node server and the edge, and
 * the privacy filter every event passes through before it leaves.
 *
 * EYRA's errors can carry personal data: a customer's email or phone in an
 * error message, a private review token in a URL, an address in a logged
 * object, request headers and bodies on the server. Automatic collection is
 * off (DATA_COLLECTION), and scrubEvent does not trust that: it walks the
 * whole event and fails closed. Fields it does not know are scrubbed, too
 * deep is dropped, and the request is rebuilt from an allowlist. Pure, so it
 * is tested without Sentry.
 */

import type { BrowserOptions, Breadcrumb, ErrorEvent } from "@sentry/nextjs";

type TransactionEvent = Parameters<NonNullable<BrowserOptions["beforeSendTransaction"]>>[0];
type AnyEvent = ErrorEvent | TransactionEvent;

/** Which deployment sent the event: Vercel production or preview, else development. */
export function sentryEnvironment(values: { override?: string; vercel?: string }): string {
  return values.override || values.vercel || "development";
}

// ── Text ─────────────────────────────────────────────────────────────────

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Indian mobile numbers, with or without +91, not inside a longer number.
const PHONE = /(?<![\d])(?:\+?91[\s-]?)?[6-9]\d{9}(?![\d])/g;
const JWT = /\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g;
const BEARER = /\b(Bearer|Basic)\s+[\w.~+/=-]+/gi;
// "password=…", "token: …", "api_key=…" written into a message.
const SECRET_PAIR = /\b(password|passwd|secret|token|api[_-]?key|access[_-]?token|authorization|otp|cvv)(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&)]+)/gi;
// Payment and service keys (Stripe-style, Razorpay, Resend, webhook secrets).
const API_KEY = /\b(?:(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{8,}|rzp_(?:live|test)_[A-Za-z0-9]{8,}|re_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,})\b/g;
// 13 to 19 digits, maybe grouped: only replaced when it passes the card checksum (so AWBs and ids stay).
const CARD = /\b\d(?:[ -]?\d){12,18}\b/g;

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}

// Database errors: Postgres's "Key (email)=(…) already exists", and quoted values in a quoted SQL statement.
const DB_KEY_DETAIL = /\bKey \(([^)]*)\)=\(([^)]*)\)/g;
const SQL_STATEMENT = /\b(insert\s+into|update\s+\S+\s+set|delete\s+from|select\s.+\sfrom|where)\b/i;

/** Personal data and secrets in free text, replaced. Ids, amounts and AWBs stay. */
export function scrubText(text: string): string {
  const db = SQL_STATEMENT.test(text) ? text.replace(/'(?:[^']|'')*'/g, "'[filtered]'") : text;
  return db
    .replace(DB_KEY_DETAIL, "Key ($1)=([filtered])")
    .replace(JWT, "[jwt]")
    .replace(BEARER, "$1 [filtered]")
    .replace(SECRET_PAIR, "$1$2[filtered]")
    .replace(API_KEY, "[key]")
    .replace(EMAIL, "[email]")
    .replace(CARD, (match) => (luhn(match.replace(/\D/g, "")) ? "[card]" : match))
    .replace(PHONE, "[phone]");
}

// ── URLs ─────────────────────────────────────────────────────────────────

/** Path segments that are private tokens: /review/<token>. */
const TOKEN_PATHS: RegExp[] = [/^(\/review\/)[^/?#]+/];

/** A URL with private path tokens replaced and every query value removed (the names stay, for debugging). */
export function scrubUrl(value: string): string {
  let url: URL;
  const relative = value.startsWith("/");
  try {
    url = new URL(value, "http://relative.invalid");
  } catch {
    return scrubText(value);
  }
  let path = url.pathname;
  for (const pattern of TOKEN_PATHS) path = path.replace(pattern, "$1[token]");
  const names = [...new Set([...url.searchParams.keys()])];
  const query = names.length ? `?${names.map((n) => `${encodeURIComponent(n)}=[filtered]`).join("&")}` : "";
  // Credentials in the URL (https://user:pass@host) are dropped with the rest of the origin's userinfo.
  return `${relative ? "" : url.origin}${scrubText(path)}${query}`;
}

/** URLs inside free text (span descriptions such as "GET https://…?pincode=…", "GET /review/abc"), then the text itself. */
function scrubUrlsInText(text: string): string {
  const urls = text.replace(/(https?:\/\/[^\s"'<>]+|\/[^\s"'<>]*\?[^\s"'<>]*)/g, (match) => scrubUrl(match));
  return scrubText(urls.replace(/\/review\/(?!\[token\])[^/?#\s"'<>]+/g, "/review/[token]"));
}

// ── Values ───────────────────────────────────────────────────────────────

/** Key words that mark a value as personal or secret, matched on snake_case, camelCase, kebab-case and dotted keys. */
const PERSONAL_WORDS = /(^|_)(email|e_mail|phone|mobile|contact|name|first_?name|last_?name|full_?name|address|address_1|address_2|street|landmark|city|pincode|pin_code|postal_code|zip|password|passwd|token|secret|authorization|cookie|session|api_?key|signature|otp|cvv|card|upi|vpa|aadhaar|pan|dob|birth|ip|ip_address)($|_)/;

/** "customerEmail" -> "customer_email", "x-razorpay-signature" -> "x_razorpay_signature". */
function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-.\s]+/g, "_")
    .toLowerCase();
}

export function isPersonalKey(key: string): boolean {
  return PERSONAL_WORDS.test(normalizeKey(key));
}

const MAX_DEPTH = 8;

/**
 * Any value, scrubbed: strings cleaned, personal keys replaced, at any depth.
 * Fails closed: deeper than MAX_DEPTH, or a cycle, becomes "[filtered]".
 */
export function scrubValue(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === "string") return scrubUrlsInText(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH || seen.has(value)) return "[filtered]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = isPersonalKey(key) ? "[filtered]" : scrubValue(item, depth + 1, seen);
  }
  return out;
}

// ── Event parts ──────────────────────────────────────────────────────────

/** Request headers worth keeping; the rest (cookies, auth, signatures, forwarded IPs) are dropped. */
const KEPT_HEADERS = new Set(["user-agent", "referer", "content-type", "accept", "host", "x-vercel-id"]);

/** The request, rebuilt from what is known to be safe: method, cleaned URL, a few headers. Everything else is dropped. */
function scrubRequest(request: AnyEvent["request"]): AnyEvent["request"] {
  if (!request || typeof request !== "object") return undefined;
  const out: NonNullable<AnyEvent["request"]> = {};
  if (typeof request.method === "string") out.method = request.method;
  if (typeof request.url === "string") out.url = scrubUrl(request.url);
  if (request.headers && typeof request.headers === "object") {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (!KEPT_HEADERS.has(key.toLowerCase())) continue;
      headers[key] = key.toLowerCase() === "referer" ? scrubUrl(String(value)) : scrubText(String(value));
    }
    out.headers = headers;
  }
  return out;
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  const out: Breadcrumb = { ...crumb };
  if (typeof out.message === "string") out.message = scrubUrlsInText(out.message);
  if (out.data) {
    const data: Record<string, unknown> = { ...out.data };
    for (const key of ["url", "from", "to"]) if (typeof data[key] === "string") data[key] = scrubUrl(data[key] as string);
    out.data = scrubValue(data) as Record<string, unknown>;
  }
  return out;
}

type Exception = NonNullable<NonNullable<ErrorEvent["exception"]>["values"]>[number];

function scrubException(exception: Exception): Exception {
  const out: Exception = { ...exception };
  if (typeof out.value === "string") out.value = scrubUrlsInText(out.value);
  if (typeof out.type === "string") out.type = scrubText(out.type);
  if (out.mechanism?.data) out.mechanism = { ...out.mechanism, data: scrubValue(out.mechanism.data) as Record<string, string | boolean> };
  if (out.stacktrace?.frames) {
    out.stacktrace = {
      ...out.stacktrace,
      // Frames keep where the code ran; local variable values (vars) never leave.
      frames: out.stacktrace.frames.map((frame) => {
        const kept = { ...frame };
        delete kept.vars;
        return kept;
      }),
    };
  }
  return out;
}

/**
 * Contexts Sentry fills with device and runtime facts: kept as they are. "log"
 * (the "[area] …" line from console-errors.ts) and "response" are scrubbed.
 * Any other context is dropped: a free-text address in an unknown field cannot
 * be recognised, so it is not sent at all.
 */
const SCRUBBED_CONTEXTS = new Set(["log", "response"]);
const SAFE_CONTEXTS = new Set(["trace", "runtime", "os", "device", "browser", "app", "culture", "cloud_resource", "react", "nextjs", "otel"]);

function scrubContexts(contexts: AnyEvent["contexts"]): AnyEvent["contexts"] {
  if (!contexts) return contexts;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(contexts)) {
    if (key === "trace" && value && typeof value === "object") {
      // Ids and status stay; the span's attributes (full URLs, query strings) are cleaned.
      const trace = { ...(value as Record<string, unknown>) };
      if (trace.data && typeof trace.data === "object") {
        const data = { ...(trace.data as Record<string, unknown>) };
        delete data["http.query"];
        delete data["http.fragment"];
        trace.data = scrubValue(data);
      }
      out[key] = trace;
    } else if (SAFE_CONTEXTS.has(key)) out[key] = value;
    else if (SCRUBBED_CONTEXTS.has(key)) out[key] = scrubValue(value);
  }
  return out as AnyEvent["contexts"];
}

/** Event fields set by the SDK with no customer data in them: left alone. */
const STRUCTURAL = new Set([
  "event_id",
  "timestamp",
  "start_timestamp",
  "platform",
  "level",
  "logger",
  "release",
  "dist",
  "environment",
  "sdk",
  "type",
  "debug_meta",
  "measurements",
  "modules",
  "server_name",
  // Internal to the SDK, removed before sending; scrubbing it would break the SDK.
  "sdkProcessingMetadata",
]);

function scrubAny<E extends AnyEvent>(event: E): E {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (STRUCTURAL.has(key)) out[key] = value;
    // A person is never identified in Sentry; anything an integration set is dropped.
    else if (key === "user") continue;
    else if (key === "request") out.request = scrubRequest(value as AnyEvent["request"]);
    else if (key === "exception") {
      const exception = value as ErrorEvent["exception"];
      out.exception = exception?.values ? { ...exception, values: exception.values.map(scrubException) } : exception;
    } else if (key === "breadcrumbs") out.breadcrumbs = (value as Breadcrumb[]).map((b) => scrubBreadcrumb(b) ?? b);
    else if (key === "contexts") out.contexts = scrubContexts(value as AnyEvent["contexts"]);
    else if (key === "tags") out.tags = scrubValue(value);
    else if (key === "spans") {
      out.spans = (value as NonNullable<TransactionEvent["spans"]>).map((span) => {
        const data = span.data ? { ...span.data } : undefined;
        if (data) {
          delete data["http.query"];
          delete data["http.fragment"];
        }
        return { ...span, description: span.description ? scrubUrlsInText(span.description) : span.description, data: data ? (scrubValue(data) as typeof span.data) : data };
      });
    }
    // message, logentry, extra, transaction, fingerprint and any field not listed here.
    else out[key] = scrubValue(value);
  }
  return out as E;
}

type StreamedSpan = Parameters<NonNullable<BrowserOptions["beforeSendSpan"]>>[0];

/** Span attributes that hold a URL or its query: the URL cleaned, the query dropped. */
const URL_ATTRIBUTES = new Set(["http.target", "http.url", "url.full", "url.path", "http.route", "next.route", "url"]);
const DROPPED_ATTRIBUTES = new Set(["http.query", "url.query", "http.fragment", "url.fragment"]);

/**
 * Sentry's beforeSendSpan. Sentry 11 sends spans one by one (span streaming),
 * not inside a transaction, so beforeSendTransaction never sees them. Their
 * attributes carry request targets such as "/?__clerk_handshake=<session JWT>".
 */
export function scrubSpan(span: StreamedSpan): StreamedSpan {
  const attributes: Record<string, unknown> = {};
  for (const [key, attribute] of Object.entries(span.attributes ?? {})) {
    if (DROPPED_ATTRIBUTES.has(key)) continue;
    const value = attribute && typeof attribute === "object" && "value" in attribute ? (attribute as { value: unknown }).value : attribute;
    let clean: unknown;
    // Sentry's own attributes are ids and SDK facts, kept as they are so traces link; the segment name can hold a path.
    if (key === "sentry.segment.name" && typeof value === "string") clean = scrubUrlsInText(value);
    else if (key.startsWith("sentry.")) clean = value;
    else if (isPersonalKey(key)) clean = "[filtered]";
    else if (typeof value === "string") clean = URL_ATTRIBUTES.has(key) ? scrubUrl(value) : scrubUrlsInText(value);
    else clean = scrubValue(value);
    attributes[key] = attribute && typeof attribute === "object" && "value" in attribute ? { ...(attribute as object), value: clean } : clean;
  }
  return { ...span, name: scrubUrlsInText(span.name), attributes: attributes as StreamedSpan["attributes"] };
}

/** Sentry's beforeSend: every error event passes through here. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  return scrubAny(event);
}

/** Sentry's beforeSendTransaction: the same for performance traces. */
export function scrubTransaction(event: TransactionEvent): TransactionEvent {
  return scrubAny(event);
}

/**
 * What the SDK may collect. Sentry 11 collects everything by default (cookies,
 * including Clerk's session token, request and response bodies, query values,
 * local variables, user details), so all of it is off. Only a few harmless
 * request headers are kept.
 */
export const DATA_COLLECTION: NonNullable<BrowserOptions["dataCollection"]> = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: [...KEPT_HEADERS] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
};

/**
 * Which browser requests carry Sentry's trace headers (sentry-trace, baggage):
 * this site's own requests, so a server error links to the page that caused
 * it, except the analytics proxy (/ev). That one forwards to PostHog, and
 * Sentry's ids have no business there.
 */
export function browserTracePropagationTargets(origin: string): RegExp[] {
  const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [new RegExp(`^(?:${escaped})?/(?!/|ev(?:[/?#]|$))`)];
}

/** Settings shared by every runtime. tracesSampleRate: one request in ten is traced. */
export function sentryOptions(values: { dsn?: string; environment: string; release?: string }) {
  return {
    dsn: values.dsn,
    enabled: Boolean(values.dsn),
    environment: values.environment,
    // The Git commit of the deployment, so an error points at the code that ran.
    release: values.release || undefined,
    dataCollection: DATA_COLLECTION,
    tracesSampleRate: 0.1,
    // Objects in events are cut at this depth by Sentry itself; the filter goes deeper anyway.
    normalizeDepth: 6,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubTransaction,
    beforeSendSpan: scrubSpan,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}

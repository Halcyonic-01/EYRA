# Error monitoring (Sentry)

What reaches Sentry from the storefront, what never does, and how to check it.
The backend's part is in `eyra-medusa-backend/docs/error-monitoring.md`.

## How errors reach Sentry

| Where it fails | How Sentry hears | Shown in Sentry as |
|---|---|---|
| Browser: a click handler, an effect, a promise | Sentry's global handlers | unhandled |
| Browser: a page crashes while rendering | `app/error.tsx`, `app/global-error.tsx` | handled, with the page |
| Server: a route handler, page or server action throws | `onRequestError` in `instrumentation.ts` | unhandled, with the request |
| Server: a promise nobody awaited fails | Sentry's Node handler | unhandled |
| Server: a failure the code catches and logs as `console.error("[area] …")` | `lib/monitoring/console-errors.ts` | handled, tag `log_area` |

- **Caught failures count.** Most server failures (a Shiprocket call, a payment
  session, an email) are caught and logged rather than thrown. Every one of those
  logs starts with an `[area]` tag, and each becomes a Sentry event. The error's
  stack is attached when the log includes the error.
- **No duplicates.**
  - A server crash is reported once, by `onRequestError`. Next's own "⨯" crash log
    is not reported again.
  - When a server crash shows the error page in the browser, the browser's copy
    (which has a `digest` and a hidden message) is not reported again.
- **Noise left out:**
  - errors from browser extensions and `ResizeObserver` warnings
  - Clerk's "no middleware" error when a missing static file such as
    `/favicon.ico` renders the 404 page
- **Settings in one place:** `lib/monitoring/sentry.ts` holds the settings shared by
  the browser, the Node server and the edge, and the privacy filter.

## Privacy

Sentry 11 collects cookies, request and response bodies, query values, local
variables and user details **by default**. All of that is turned off
(`DATA_COLLECTION`).

`scrubEvent` doesn't rely on that: it walks the whole event and **fails closed**.

- **Request:** rebuilt from an allowlist, so any field Sentry adds later is
  dropped too. What's kept:
  - the method
  - the cleaned URL
  - only the `user-agent`, `referer`, `content-type`, `accept` and `host` headers
- **User:** removed. Nobody is identified in Sentry.
- **Exceptions:** messages are cleaned (every exception in a chain). Mechanism
  data is scrubbed, and local variable values are removed from stack frames.
- **Breadcrumbs, tags, spans, the trace's attributes, `extra`, `logentry`,
  `fingerprint`, and any field not listed:** scrubbed in depth.
  - **Personal keys:** a value is replaced by `[filtered]` when its key names
    personal or secret data (email, phone, name, address, pincode, token,
    signature, card, UPI…). Keys are matched in any casing: `customerEmail`,
    `customer_email`, `x-razorpay-signature`, `user.email`.
  - **Too deep or circular:** values more than 8 levels deep, and circular
    references, become `[filtered]` rather than being sent.
- **Spans (performance):** Sentry 11 sends spans one by one ("span streaming"),
  and `beforeSendTransaction` never sees them. `scrubSpan` (`beforeSendSpan`)
  cleans their attributes, because a request target can carry Clerk's
  `__clerk_handshake` session token.
- **Contexts:** device and runtime contexts are kept. The `log` context is
  scrubbed, and **any other context is dropped**.
- **Text everywhere:**
  - emails, Indian phone numbers, card numbers (checked with the card checksum,
    so AWBs and ids stay), JWTs, `Bearer` tokens, `password=…` / `token: …`
    pairs, payment API keys
  - quoted values in SQL, and Postgres's `Key (…)=(…)` details
  - URL query values (the names stay)
  - private review tokens in paths
- **The limit:** a street address written as plain prose in a log message can't
  be recognised by any pattern. So error logs carry ids (order, cart, AWB), never
  a customer's details. The test suite checks that none do today. The pincode was
  removed from the Shiprocket error logs.

`tests/e2e/monitoring-logic.spec.ts` feeds one event with personal data and secrets
in every field, including unknown ones, 12 levels deep and circular. It checks
that none survives, and that ids, amounts, AWBs, stack frames and trace ids do.

Session replay is not used in Sentry. Replays, if they are wanted, are PostHog's
job, with inputs masked.

## What counts as an error

The rule: `console.error("[area] …")` is reported, and `console.warn` is not.

- **An error** is something someone has to look at: an outside service failing
  or misconfigured, a payment that can't be confirmed, an email that gave up.
- **Expected outcomes are warnings:**
  - a product that doesn't exist (404)
  - an email attempt that will be retried
  - a payment the customer declined (not logged at all)
- **Each failure is reported once:**
  - an email's retried attempt is a warning, and only the attempt that gives up
    is an error
  - a refused PayU return is reported by the return route, not again on each
    status check
- **Customer mistakes aren't logged as errors at all:** a declined payment, an
  invalid discount code, out of stock at checkout. They are shown to the
  customer.

Checked by running the whole test suite against a fake Sentry and listing every
event it produced (see Testing).

## Environments and releases

- **Environment:** `production` or `preview` from Vercel, otherwise
  `development`. A local `npm start` is development too. Set
  `NEXT_PUBLIC_SENTRY_ENVIRONMENT` to name another (for example `staging`).
- **Release:** the Git commit Vercel built (`VERCEL_GIT_COMMIT_SHA`). Each error
  says which deployment it came from, and Sentry can mark an issue as fixed in a
  release.
- **Recommended:** one Sentry project per app (storefront, backend). Use the
  environment filter to keep previews and development out of production alerts.
  Alerts should be set to `environment:production`.

## Readable stack traces

- **With a token:** if `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` are set
  in Vercel (build), source maps are made, uploaded to Sentry for the release,
  then **deleted from the build**, so they are never public.
- **Without a token:** no source maps are made, and browser stack traces point at
  minified files.
- **The token:** create it in Sentry under Settings, Auth Tokens, with the
  `project:releases` scope only. Keep it out of `NEXT_PUBLIC_`.

## Performance

- **Sampling:** one request in ten is traced (`tracesSampleRate: 0.1`). That's
  enough to see slow pages and API routes on a small shop at low cost.
- **Trace headers** go only to the Medusa backend
  (`tracePropagationTargets`), never to Razorpay, PayU, Shiprocket or Resend. A
  backend error therefore shows up on the same trace as the storefront request
  that caused it.

## Checking it in Sentry

1. Set the DSN in Vercel Preview only, and deploy a preview.
2. **Issues**, filter `environment:preview`: errors appear with the release (the
   commit) and readable stack traces (if the token is set).
3. Open an event and check:
   - the request has no cookies or body
   - query values read `[filtered]`
   - no email or phone number appears
4. **Issues**, search `log_area:medusa-order` (or any area): the caught failures.
5. **Performance** (Traces): the sampled requests. A storefront request that
   called the backend shows the backend error on the same trace.
6. **Alerts:** create "a new issue in production" and "more than 20 events in an
   hour" alerts, filtered to `environment:production`.
7. **Releases:** each Vercel deployment's commit, with its new and resolved
   issues.

## Testing

- `tests/e2e/monitoring-logic.spec.ts`: settings, the privacy filter, which logs
  are reported. No server needed.
- Checked by hand against a fake Sentry server on a production build: one event
  per failure, with the right mechanism; nothing personal sent; environment and
  release set.
- **Every envelope item scanned** (spans, client reports, events) for emails,
  phone numbers, JWTs, the Clerk handshake and query values: none found. Before
  `scrubSpan`, spans carried session JWTs.
- **The whole suite against a fake Sentry:** every event it produced was listed
  and matched to the test that caused it. That's how the duplicates and expected
  outcomes above were found and fixed.

## Not done, on purpose

- **No tunnel** (`tunnelRoute`). Some ad-blockers drop browser error reports. A
  tunnel route on the shop's own domain would recover them, at the cost of every
  report becoming a Vercel function call. Add it if browser errors look
  under-counted.
- **No Sentry session replay or user feedback widget**, which aren't needed.
- **No Vercel cron monitors**; the shop has no Vercel cron jobs.

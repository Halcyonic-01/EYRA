# Product analytics (PostHog)

What EYRA measures, how it gets to PostHog, and what never leaves the
customer's browser. The backend's part is in `eyra-medusa-backend/docs/analytics.md`.

## Architecture

```
Browser (Next.js storefront)                       Backend (Medusa)
──────────────────────────────                     ───────────────────────────
AnalyticsBridge (app mount) ── initAnalytics()     subscribers/analytics-order-events.ts
lib/analytics/client.ts   ── track(), identify       (order.placed, order.canceled)
   │  posthog-js, loaded lazily                         │  utils/posthog.ts: one HTTP POST
   │  before_send: lib/analytics/privacy.ts             │
   ▼                                                    ▼
/ev/*  (same origin) ── next.config rewrite ──▶ eu.i.posthog.com ◀── /i/v0/e/
```

- **One tracking layer.** Only `lib/analytics/client.ts` imports `posthog-js`.
  Components call `track(event, properties)`. Every event and its properties are
  declared once in `lib/analytics/events.ts`, and TypeScript rejects any other event.
- **Consent first.** Nothing is loaded, stored or sent until the customer accepts
  analytics; see "Consent" below.
- **Off unless configured.** Without `NEXT_PUBLIC_POSTHOG_KEY` every call does
  nothing and `posthog-js` is never downloaded. Development builds stay quiet unless
  a development project's key is set.
- **Cannot break the shop.**
  - `posthog-js` loads after the app starts (a dynamic import), so it never delays
    the first paint.
  - Calls made before it is ready wait in a short queue of up to 50.
  - Every call is wrapped, and a blocked or failed load is ignored.
  - On the backend, the send has a 5-second timeout and a failure is logged as a
    warning. The order is untouched, and a backlog job sends the event later.
- **Reverse proxy.** The browser sends to `/ev` on the shop's own domain, and
  `next.config.ts` rewrites it to PostHog.
  - Ad-blockers drop direct calls to PostHog. A first-party path keeps the numbers
    honest, and it's PostHog's own recommendation.
  - `/ev` is excluded from the middleware (`proxy.ts`), so Clerk and launch mode
    never touch it.
  - PostHog's paths end in `/`, so Next's trailing-slash redirect is turned off
    (`skipTrailingSlashRedirect`). `proxy.ts` keeps redirecting `/about/` to
    `/about` for pages, so URLs behave as before.
- **Orders are counted on the server.** An order can be placed by the customer's
  browser, by a payment webhook, or by the sweep that recovers missed payments, and
  only the backend sees all of them. So `order_placed` and `order_cancelled` come
  from a Medusa subscriber, not from the success page. Each is sent exactly once
  per order, even when Medusa announces an order twice. See the backend's
  `docs/analytics.md`, "Exactly once".

## Events

Naming: snake_case, object then past-tense verb. Properties hold ids, rupee amounts
and fixed categories only.

| Event | Sent from | When | Why it matters |
|---|---|---|---|
| `$pageview`, `$pageleave` | posthog-js | Every page, including client-side navigation | Traffic, entry pages, the funnel's first step |
| `product_viewed` | `ProductDetailClient` | Once per product shown | Which products draw interest; view-to-cart rate |
| `product_added_to_cart` | `store/useStore.ts` | After the server confirms the line | Purchase intent. Refused adds (out of stock) are not counted |
| `product_removed_from_cart` | `store/useStore.ts` | After the server removes the line | Cart abandonment by product |
| `checkout_started` | `CheckoutClient` | Once per visit to checkout with items | Checkout funnel step 1 |
| `payment_method_selected` | `CheckoutClient` | The customer picks a different method | Method mix (Razorpay, PayU, COD) |
| `payment_started` | `CheckoutClient` | Pay or Place order clicked, all checks passed | Funnel step: tried to pay |
| `payment_failed` | `CheckoutClient`, `PayuStatus` | Declined, abandoned, refused, unconfirmed or error | Where money is lost; gateway reliability |
| `payment_method_switched` | `CheckoutClient` | Another method chosen from the failure panel | Whether the manual PayU or COD fallback rescues sales |
| `order_placed` | backend | Every order, once | Conversions and revenue: the source of truth |
| `order_cancelled` | backend | Every cancellation, once | Net revenue, cancellation rate |

Not tracked, on purpose:
- **Autocapture** is off. It records the text of whatever is clicked, adds noise and
  cost, and duplicates the explicit events.
- **Search terms** aren't sent. People type names and phone numbers into search boxes.
- **Errors** aren't sent. They already go to Sentry.

## Who is who

- **Visitors are anonymous.** PostHog gives each browser a random id, and no person
  profile is created (`person_profiles: 'identified_only'`, which is also cheaper).
- **Sign-in.** `components/analytics/AnalyticsBridge.tsx` calls `identify` with the
  customer's **Medusa customer id** (`cus_…`), read from Clerk's public metadata.
  PostHog merges the visitor's anonymous history into that person, so "viewed, added
  to bag, signed in, paid" is one journey.
  - Why that id: it's pseudonymous, never changes, and the backend knows it too. The
    backend sends `order_placed` under the same id, so server events join the
    browser journey without any extra plumbing.
  - The email is never the id, and no person properties (name, email, phone) are set.
- **Sign-out** calls `reset`, so the next person on a shared device starts as a new
  anonymous visitor.
- **Checkout** requires sign-in, so every order belongs to an identified customer.

## Privacy

Everything passes through `before_send` (`lib/analytics/privacy.ts`) before it leaves
the browser:

- **URLs keep only their path and `utm_*` tags.** Query strings carry order and
  payment references, and review links carry a private token in the path
  (`/review/<token>` becomes `/review/[token]`).
- **Personal-looking properties are dropped.** Any property named like personal data
  (email, phone, name, address, pincode…) is removed, as a last line of defence.
- **Bots are left out.** PostHog drops events from bots and headless browsers.

**Session replay** is off unless `NEXT_PUBLIC_POSTHOG_REPLAY=true` *and* replay is on
in the PostHog project (where sampling is set). When on:

- **Every input is masked:** addresses, phone numbers, the pincode, everything.
- **These pages are never recorded:** `/account`, `/orders`, `/wallet`, `/sign-in`,
  `/sign-up`, `/review`, `/support` and `/contact`. They show personal data as plain
  text.
- **Single elements can be masked:** add `data-ph-mask` to an element to mask its text
  in recordings, or the `ph-no-capture` class to black it out entirely.
- **Payment details aren't recorded.** The Razorpay and PayU payment pages are other
  sites, never recorded.

The privacy policy already names PostHog (`app/privacy-policy`). If replay is turned
on, consider adding "session recordings with typed details masked" to that line.

## Configuration

| Where | Variable | Notes |
|---|---|---|
| Storefront | `NEXT_PUBLIC_POSTHOG_KEY` | The project token (`phc_…`), public by design. A personal key (`phx_…`) is refused. |
| Storefront | `NEXT_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` (default) or `https://us.i.posthog.com` |
| Storefront | `NEXT_PUBLIC_POSTHOG_REPLAY` | `true` to allow session replay |
| Storefront | `NEXT_PUBLIC_POSTHOG_DEBUG` | `true` logs PostHog's decisions in the console (development) |
| Backend | `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST` | Same project and region as the storefront |

The `NEXT_PUBLIC_` values are read at build time, so change them and redeploy.

**Separate projects.** Use one PostHog project for production (Vercel and Railway
production) and another for development and previews (`.env.local`, Vercel Preview).
Real numbers never mix with test traffic.

**PostHog project settings to set once:**
- the session replay sample rate
- "Discard client IP data", so no IP address is stored (PostHog then shows only
  a rough country)
- the data retention you want

## Using the data in PostHog

- **Purchase funnel.** Product analytics, then New insight, then Funnel:
  `product_viewed` → `product_added_to_cart` → `checkout_started` →
  `payment_started` → `order_placed`. Break it down by `payment_method` or by
  device type.
- **Revenue.** A Trends insight on `order_placed`, "Property value sum" of `value`.
  Subtract `order_cancelled` for net revenue.
- **Gateway health.** A Trends insight on `payment_failed`, broken down by `method`
  and `reason`. A rise in `declined` for one gateway is worth a look.
- **Fallback value.** `payment_method_switched` followed by `order_placed` (a funnel)
  shows the sales the manual fallback saved.
- **One customer's journey.** Persons, then a `cus_…` id. Search by the customer id
  from the Medusa admin.
- **Replays.** Session replay, filtered by event (for example sessions with
  `payment_failed`) to watch where checkout went wrong.
- **Dashboards.** Pin the funnel, revenue and gateway-health insights to one
  "Shop health" dashboard.

## Testing

- `tests/e2e/analytics-logic.spec.ts`: configuration, URL cleaning, the personal-data
  filter, replay page rules, trailing slashes. No server needed.
- `tests/e2e/analytics.spec.ts`: what the browser really sends, on desktop and phone,
  caught in the browser so nothing reaches PostHog. Needs a build with a key:

  ```bash
  NEXT_PUBLIC_POSTHOG_KEY=phc_e2etestkeyonly000 npm run build && npm start
  E2E_ANALYTICS=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/analytics.spec.ts
  ```

  The normal suite runs without a key, which also checks the shop works with
  analytics off.
- Backend: `src/utils/__tests__/posthog.unit.spec.ts` and
  `integration-tests/http/analytics.spec.ts` (a real order through Medusa, PostHog
  intercepted).

## Trade-offs and limits

- **Consent first.** Nothing runs until the customer accepts (see "Consent"), so
  the numbers only cover people who said yes, which is usually a minority of
  visitors.
- **Events from a closed tab can be lost.** Browser events are batched every few
  seconds. Orders aren't affected (they're counted on the server).
- **No heatmaps.** Heatmaps need autocapture, which is off. Turn on
  `capture_heatmaps` later if needed.
- **No feature flags or experiments yet.** posthog-js supports them; flags would be
  read through `lib/analytics/client.ts` when wanted.
- **Server-side events arrive late, not never.** If PostHog is down, the backlog
  job sends the event within about 15 minutes, for orders up to 3 days old. For
  exact revenue reporting (accounts, GST), Medusa stays the source of truth.

## Consent

Analytics runs only after the customer explicitly accepts it. Until then, and
after a "no", PostHog doesn't exist on the page: no script, no cookie, no
request and no event. This isn't legal advice; the approach follows the DPDP Act's
consent rules (free, specific, informed, a clear yes, withdrawable as easily as
given) and is also GDPR-safe for EU visitors.

### The choice

- **Asking.** A banner (`components/analytics/ConsentBanner.tsx`) asks before
  anything runs:
  - it says what is collected and why
  - "Accept analytics" and "Decline" carry equal weight
  - it links to the privacy policy
  - it shows only when PostHog is configured
- **Remembered** in a first-party cookie, `eyra_analytics_consent`. It holds the
  status, when it was given, and the notice version (`granted.1.<time>`). It's
  strictly necessary (it only remembers the choice) and lasts 12 months, after
  which the customer is asked again.
  - A missing, unreadable or older-version cookie counts as not asked, which
    means no analytics.
  - Raise `CONSENT_VERSION` (in `lib/analytics/consent.ts` and the backend's
    `analytics-consent.ts`) when what is collected changes. Everyone is then asked
    again.
- **Changing it:** "Analytics settings" in the footer reopens the banner from any
  page. It shows the current choice and offers "Withdraw consent".

### In the browser (`lib/analytics/client.ts`)

| State | What happens |
|---|---|
| Not asked yet | `posthog-js` isn't downloaded. Every `track`, `identify` and replay call is **dropped**, not queued, so nothing from before the choice is ever sent. |
| Declined | Same as not asked, on every visit. |
| Accepted | `posthog-js` loads and starts at that moment, then on each visit. |
| Withdrawn | PostHog stops capturing and replay, and its persistence is switched off. Its cookies and storage are deleted, on this host and the parent domain, which also removes the anonymous id and the link to the customer. The page then reloads, so no PostHog code keeps running. |

- **Other tabs** follow a change (`BroadcastChannel`).
- **The analytics proxy** (`/ev`) is never called without consent, because only
  PostHog calls it.

### On the server: order events

`order_placed` and `order_cancelled` come from the backend, which checks the same
choice:

- When a signed-in customer chooses, or signs in with a choice already made, the
  storefront records it on their Medusa profile (`/api/analytics/consent` writes
  `metadata.analytics_consent`).
  - A visitor's choice is sent again after sign-in.
  - A failed save is retried on the next page load.
- The backend sends an event only if the customer's **current** choice is "yes"
  **and** was given before the event happened.
  - No choice, or "no": never sent.
  - Withdrawn: nothing more is sent, including events still waiting in the
    backlog job.
  - Not retroactive: an order placed before the customer accepted is never sent.
  - Checked inside `sendOrderEvent`, which both the order subscriber and the
    backlog job use.
- **Per customer:** the profile holds the latest choice from any of their
  devices. Saying "no" anywhere stops order events.

### Sentry is separate

Sentry is error monitoring, not analytics. It starts first in
`instrumentation-client.ts`, which PostHog doesn't touch, and doesn't depend on this choice. A test checks that
it still reports when analytics is declined. Its privacy filtering is described
in `docs/error-monitoring.md`.

### Tests

- `tests/e2e/analytics-logic.spec.ts`: reading the cookie, "only a clear yes",
  which storage withdrawal removes.
- `tests/e2e/analytics-consent.spec.ts`:
  - The consent API (normal suite).
  - In a real browser (build with a key):
    - **missing and declined:** no requests to `/ev`, no PostHog cookies or
      storage, `posthog-js` not loaded, also after a reload and on other pages
    - **accepted:** events start, and nothing from before the choice is sent
    - **remembered** on the next visit
    - **withdrawn** from the footer: the page reloads, PostHog's cookies and
      storage are gone, and nothing more is sent
    - **Sentry** still reports when analytics is declined
- Backend: `analytics-consent.unit.spec.ts`, and `integration-tests/http/analytics.spec.ts`
  with real orders for granted, missing, declined, withdrawn after the order,
  given after the order, and withdrawn before a cancellation.

### Still to do outside the code

- **Privacy policy:** the PostHog line should say analytics is optional,
  asked first, and can be withdrawn from "Analytics settings". That's legal text,
  so it's left to whoever owns the policy.
- **Data already in PostHog when someone withdraws:** stopping is automatic;
  deleting what was collected before isn't. A customer who asks for erasure can be
  deleted in PostHog (Persons, search their `cus_…` id, Delete person and data),
  or a backend job can call PostHog's API with a personal API key.
- **Shared devices:** the choice belongs to the browser, so the next person on the
  same browser inherits it until they change it.

## Future improvements

- Return and exchange events (`return_requested`) from the backend.
- `signed_up` from a Clerk webhook, for acquisition funnels.
- Deleting a customer's PostHog data automatically when they withdraw or ask for
  erasure.

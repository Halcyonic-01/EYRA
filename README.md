This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Customer emails (Resend)

All customer email goes out through [Resend](https://resend.com) from this app (`lib/email.ts`). The Medusa backend decides *when* an email is due and calls `POST /api/wallet/notify`; this app owns the wording and the sending. Nothing about emails is stored in the backend except a small "already sent" marker on each order.

| Email | Sent when | Who gets it |
| --- | --- | --- |
| Order confirmation | the order is placed | customer |
| Order shipped | the courier shipment is created | customer |
| Order delivered | the courier reports delivery | customer |
| Order cancelled (with refund details) | the customer cancels | customer |
| Refund on its way | a returned parcel's online payment is refunded | customer |
| Wallet credit added / request declined | staff resolve a return or exchange | customer |
| Welcome offer | someone signs up for updates | subscriber |
| Promotion | staff run a campaign (see the backend's `docs/customer-emails.md`) | subscribers only |
| Ops alerts, support tickets | something needs a person | the team |

Order and refund emails are transactional. Offers are promotional: they go only to people who signed up with the newsletter form, carry an unsubscribe link and a one-click `List-Unsubscribe` header, and are off in live mode until you turn them on.

### Environment variables

Set these on the storefront (Vercel). None of them belong in the backend, and the key must never start with `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | API key from Resend. Without it no email is sent. |
| `ORDER_EMAIL_FROM` | Sender, for example `EYRA <orders@eyra.org.in>`. Its domain must be verified in Resend. |
| `EMAIL_MODE` | `live`, `test` or `off`. Leave unset: production is live, anything else is test. |
| `EMAIL_TEST_RECIPIENT` | Where every email goes in test mode. |
| `EMAIL_PROMOTIONS_ENABLED` | `true` to allow promotional email in live mode. Default off. |
| `EMAIL_UNSUBSCRIBE_SECRET` | Signs unsubscribe links. Falls back to `STOREFRONT_REVALIDATE_SECRET`. |

The email routes also need `STOREFRONT_REVALIDATE_SECRET` (shared with the backend) and `MEDUSA_ADMIN_API_KEY`, which are already required for the rest of the site.

### Resend dashboard

1. **Domains**: add `eyra.org.in`, add the DNS records Resend shows, and wait for it to say *Verified*. Only then can mail go from `@eyra.org.in`.
2. **API Keys**: create a key with *Sending access* limited to that domain, and put it in `RESEND_API_KEY`.
3. Optional: **Webhooks** for bounces and complaints, so you can see problem addresses.

### Testing emails safely

`EMAIL_MODE=test` sends every email to `EMAIL_TEST_RECIPIENT` only, with the subject marked `[TEST for customer@example.com]`. No customer is contacted. This is also the default on your machine and on Vercel previews. For a mailbox-free check use Resend's own `delivered@resend.dev`.

With the dev server running in test mode, send any email by hand (replace the secret with your `STOREFRONT_REVALIDATE_SECRET`):

```bash
curl -s -X POST http://localhost:3000/api/wallet/notify \
  -H "x-revalidate-secret: $STOREFRONT_REVALIDATE_SECRET" -H "Content-Type: application/json" \
  -d '{"type":"order_shipped","email":"asha@example.com","first_name":"Asha","order_id":"order_1","order_number":342,"awb":"1234567890","courier":"Delhivery"}'
```

`{"sent":true}` means Resend accepted it. Other `type` values and their fields: `order_delivered` (`order_id`, `order_number`), `refund_processed` (`order_number`, `refund_amount`, `reason`, `credit_note`, `eta`), `welcome_offer` (`code`, `amount`, `min_order`), `promotion` (`subject`, `headline`, `message`, `cta_label`, `cta_url` on eyra.org.in, optional `code`, `amount`, `min_order`), plus the older `credit_added`, `request_rejected` and `order_cancelled`. To test the real flow instead, place and ship an order against a test backend and watch the test address.

Automated checks:

```bash
npx playwright test email-delivery resend-send customer-emails        # no server needed
EMAIL_ROUTE_TESTS=1 ... npx playwright test customer-email-routes      # see the top of that file
```

### Going live

1. Verify the domain and set `RESEND_API_KEY` and `ORDER_EMAIL_FROM` on Vercel (Production).
2. Leave `EMAIL_MODE` unset. Do not set `EMAIL_TEST_RECIPIENT` in Production.
3. Keep `EMAIL_PROMOTIONS_ENABLED=false` until you are ready to send offers to subscribers.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

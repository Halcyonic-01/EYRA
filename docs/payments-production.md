# Payments in production: storefront

The full runbook (configuration, migrations, deployment order, rollback,
monitoring, security review) lives in the backend repo:
`eyra-medusa-backend/docs/payments-production.md`. This page is the storefront's part.

## Variables (Vercel)

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Build time. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Live key in production, test key everywhere else. |
| `RAZORPAY_WEBHOOK_SECRET` | Secret of the Razorpay webhook to `/api/razorpay/webhook`. |
| `NEXT_PUBLIC_PAYU_ENABLED` | `true` shows PayU at checkout. Build time; turn on only after the backend is ready (backend runbook, section 5). |
| `PAYU_CHECKOUT_ORIGIN` | Leave unset. Local fake PayU only; ignored for anything but localhost. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Production's own database; never the development one. |

## Order

Deploy after the backend: the checkout and the Cash on Delivery and wallet
routes call the backend's `/store/carts/:id/payment-status`, and pause paying
("couldn't check") until it exists.

## Rollback

Vercel instant rollback. To hide PayU only: `NEXT_PUBLIC_PAYU_ENABLED=false` and redeploy.

## What the customer sees

- The checkout's payment step shows where an earlier payment stands (confirming,
  still at the bank, refund on its way) and only allows paying when the backend does.
- After a failed or closed payment it offers the other methods as buttons; it never
  switches by itself, and never while a payment may still go through.
- `/payment-status` shows the current cart's payment for customers who closed the window.
- `/payment-status/payu` is where PayU sends the customer back.

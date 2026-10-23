# Launch commerce: storefront side

The full guide, including S3 bucket and IAM setup, release steps and the open
accounting questions, is in the backend repo: `docs/launch-commerce.md`, and the
cancellation, return, exchange and credit note rules are in
`docs/returns-credit-notes-cancellations.md` there. This file covers what the
storefront does and the Vercel settings.

## What the storefront does

- **Product page**: every Medusa option other than ring size (anklet Single or
  Pair, pendant with or without a chain) is shown as a choice with its own price.
  The page opens on the cheapest option. `lib/variant-selection.ts` only matches a
  variant; it never works out a price.
- **Cart**: one line per variant, so a single and a pair of the same anklet are
  two lines at their own prices. After every change the cart reads its totals from
  the backend (`GET /store/carts/:id/summary`, read only) and shows what it
  reports. A price edited in the browser is replaced by Medusa's.
- **Discount codes**: entered in the cart (`components/cart/PromoCodeBox.tsx`,
  `app/api/cart/promo/route.ts`). The backend decides if a code fits and says why
  if not. WELCOME200 needs a signed-in account.
- **Payment method and totals**: `app/api/checkout/pricing/route.ts` asks the
  backend for the cart priced for prepaid or COD (and wallet credit). It takes no
  amounts from the browser. The payment routes (`/api/razorpay/create-order`,
  `/api/cod/complete`, `/api/wallet/pay`) set the method themselves from which
  route is called, so a client cannot choose the wrong charge.
- **Prices include 3% GST.** Shown prices are what the customer pays. The
  invoice takes a discount off first, then extracts the GST from what is left
  (`GST = amount x 3 / 103`, in `lib/gst.ts`), so taxable value plus GST always
  equals the product amount.
- **Cash on Delivery charge**: Rs 99, shown on the invoice as its own line and
  never mixed into the product amount. It includes 18% GST under SAC 9997 (taxable
  value Rs 83.90 plus GST Rs 15.10), itemised in its own row of the tax summary.
  The invoice spreads an order's discount over the product lines in proportion to
  price before taking each line's GST out (`lib/gst.ts`, `lib/invoice-view.ts`).
- **Complimentary tote**: a free line, added by the backend while the items are
  worth strictly more than Rs 1,499 (before any discount) and the tote is in
  stock (`components/offers/ToteOffer.tsx`, thresholds in `config/offers.ts`). The
  cart and checkout show it as "Free" with no remove button; below the threshold
  they say how much more to add. It is a Rs 0 line on the order, the invoice and
  the Shiprocket packing list. The shop never lists it (`hidden_from_shop`).
- **Cancelling**: before dispatch an order is refunded in full to the payment it
  came from: no fee, no wallet choice (`components/orders/CancelOrderPanel.tsx`).
  Once shipped the panel says to refuse delivery, or to return within 7 days.
- **Returns and exchanges**: open for 7 days after delivery
  (`app/orders/[id]/return`, `components/orders/ReturnRequestForm.tsx`). A return is
  paid back as store credit (what was paid less Rs 99, GST included; no fee for a damaged or defective item). An exchange picks a size
  or design and has no fee: the pickup is booked at once. Only when the new piece
  costs more does the customer pay the difference, through a Razorpay link the form
  and the order page show. The order page lists each request's
  status, the pickup, and the replacement order.
- **Credit notes**: listed on the order page with a PDF download
  (`app/orders/[id]/credit-notes/[noteId]/pdf`). The storefront draws the PDF from
  the document the backend issued (`app/api/credit-notes/render`, backend only).
- **BIS registration**: the Hallmarking registration number (`HM/C-5890248421`, or
  `BIS_REGISTRATION_NUMBER`) is in the footer of every page, the trust bar and the
  authenticity page (`components/layout/BisMark.tsx`). The official BIS Hallmark logo
  is `public/images/bis-hallmark.jpg`, the file BIS publishes on bis.gov.in (BIS's
  own mark, never redrawn). Replace the file to change it.
- **Policy wording**, fixed text in `config/policy-copy.ts`: the sticky badge on
  every product page, and the checkbox the customer must tick before an order can
  be placed.
- **Invoices**: `lib/invoice-view.ts` works out one invoice view. The page
  (`components/orders/InvoiceDocument.tsx`) and the PDF (`lib/invoice-pdf.ts`)
  both draw from it, including the GST breakdown and the COD line. `app/api/invoices/render` (backend only) draws the PDF for
  the backend to store; `app/orders/[id]/invoice/pdf` serves it to the owner.
- **Images**: `config/image-hosts.ts` lists the exact hosts Next may optimise
  images from.

## Vercel settings

See `.env.example`. New or changed for this work:

| Variable | Notes |
|---|---|
| `MEDUSA_IMAGE_HOSTS` | **Build time.** The S3 bucket (or CDN) hostname, comma separated. Exact hostnames only. |
| `SELLER_GSTIN` and the other `SELLER_*` | Required for a valid tax invoice. A missing or malformed GSTIN is reported and no PDF is kept. |
| `STOREFRONT_SHIPMENT_SECRET` | Same value as on the backend. Also protects invoice drawing. |
| `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` | Lets the token renew itself. |
| `SHIPROCKET_PICKUP_LOCATION`, `SHIPROCKET_WEBHOOK_SECRET` | Reported in the admin if missing. The webhook secret must also be set on the backend. |
| `COD_GST_RATE`, `SERVICE_SAC_CODE` | 18 and 9997. Same on the backend. |
| `SHIPROCKET_RETURN_PHONE` (and optional `SHIPROCKET_RETURN_*`) | **Required for return pickups**: the phone of the warehouse returns are delivered to. |
| `SHIPROCKET_FREE_GIFT_PRICE` | `zero` (default) or `one_rupee`, if Shiprocket rejects a zero-price tote. |
| `WHATSAPP_PROVIDER` (`wati` or `aisensy`), `WATI_API_URL`, `WATI_ACCESS_TOKEN`, `AISENSY_API_KEY`, `WHATSAPP_TEMPLATE_*` | WhatsApp messages. Nothing is sent until one is set up; the templates must be approved first. Parameter order: store credit `name, amount, valid_until, credit_note, order`; exchange link `name, amount, link, order`; replacement `name, order, title`. |

No AWS credentials belong on Vercel.

## Tests

```bash
npx tsc --noEmit
npx eslint .
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test
```

`credit-note.spec.ts`, `returns.spec.ts` and `shiprocket-return-and-whatsapp.spec.ts`
need no backend. `variants-and-offers.spec.ts` runs against a real backend that has had
`setup-launch-commerce.ts` and `seed-variant-demo.ts` run, and skips itself when
the backend is not reachable.

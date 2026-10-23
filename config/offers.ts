/**
 * The launch offers as customers read them.
 *
 * Display only. The Medusa backend is what applies and checks every one of
 * these (see apps/backend/src/utils/commerce-rules.ts there), and the cart
 * always shows the amounts it reports. Keep the two in step if an offer changes.
 */

/** Added once to a Cash on Delivery order. Prepaid orders ship free. */
export const COD_CHARGE = 99;

/**
 * Orders with items worth strictly more than this, before any discount and
 * without shipping, get a complimentary tote bag while stock lasts. The backend
 * adds it to the order as a free line; this threshold only drives the message.
 */
export const TOTE_MIN_SUBTOTAL = 1499;

/** ₹1,499 does not qualify; ₹1,500 does. */
export function qualifiesForTote(itemsSubtotal: number): boolean {
  return itemsSubtotal > TOTE_MIN_SUBTOTAL;
}

/** Rupees still to add for the tote offer, or 0 once the order qualifies. */
export function toteShortfall(itemsSubtotal: number): number {
  return qualifiesForTote(itemsSubtotal) ? 0 : Math.ceil(TOTE_MIN_SUBTOTAL + 1 - itemsSubtotal);
}

export interface DiscountOffer {
  code: string;
  /** Flat rupees off the order. */
  amount: number;
  /** One line on who it is for, and what order value it needs. */
  title: string;
  terms: string;
}

export const DISCOUNT_OFFERS: readonly DiscountOffer[] = [
  {
    code: "WELCOME200",
    amount: 200,
    title: "₹200 off your order",
    terms: "Orders above ₹1,499. Once per account. Sign in to use it.",
  },
  {
    code: "EYRA350",
    amount: 350,
    title: "₹350 off your order",
    terms: "Orders above ₹3,000.",
  },
  {
    code: "EYRA650",
    amount: 650,
    title: "₹650 off your order",
    terms: "Orders above ₹5,000.",
  },
];

/** What is offered without a code: shown on the page so nobody has to ask for them. */
export const AUTOMATIC_BENEFITS: readonly { title: string; terms: string }[] = [
  {
    title: "Free shipping on prepaid orders",
    terms: `Applied automatically at checkout. Cash on Delivery adds ₹${COD_CHARGE}.`,
  },
  {
    title: "Complimentary EYRA tote bag",
    terms: `Included with orders above ₹${TOTE_MIN_SUBTOTAL.toLocaleString("en-IN")}, subject to stock availability.`,
  },
];

/** Rupees, Indian grouping. */
export function rupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

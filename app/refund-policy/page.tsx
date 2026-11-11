import type { Metadata } from "next";
import { LegalDocument, TextLink, type Highlight, type LegalSection } from "@/components/layout/LegalDocument";
import { storeConfig } from "@/config/storeConfig";
import { COD_CHARGE } from "@/config/offers";
import { describeWindow } from "@/lib/cancellation";

export const metadata: Metadata = {
  title: "Returns, Exchanges and Refunds",
  description:
    "How to cancel an order before it ships, what to do once it has shipped, EYRA's 15-day return and 7-day exchange terms, how returns are settled as store credit, reverse pickup, and what we need to process a transit damage claim.",
};

const { contact, policy, seller } = storeConfig;

const fee = policy.reverseLogisticsFee.toLocaleString("en-IN");
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Cancelling is only offered when a cancel window is set, so its text follows that setting.
const canCancel = policy.cancelWindowMinutes > 0;
const cancelWindow = describeWindow(policy.cancelWindowMinutes);

const creditValidity =
  policy.walletCreditMonths > 0 ? `valid for ${policy.walletCreditMonths} months` : "with no expiry date";

const orders = <TextLink href={`mailto:${contact.ordersEmail}`} />;

const highlights: Highlight[] = [
  ...(canCancel
    ? [{ label: "Cancel", value: cancelWindow, note: "after ordering, for a full refund before it ships" }]
    : []),
  { label: "Returns", value: `${policy.returnDays} days`, note: "from delivery, settled as EYRA store credit" },
  { label: "Exchanges", value: `${policy.exchangeDays} days`, note: "from delivery, for a different size or design, no fee" },
  { label: "Return fee", value: `₹${fee}`, note: "per return, waived for damaged or defective items" },
];

const cancelSections: LegalSection[] = canCancel
  ? [
      {
        id: "cancel",
        heading: "Cancelling before your order ships",
        blocks: [
          `You can cancel an order yourself for ${cancelWindow} after placing it. We hold every order for this time before creating its shipment, so a cancelled order is never sent.`,
          {
            kind: "steps",
            items: [
              { title: "Open the order", body: "Go to your account and open the order you want to cancel." },
              { title: "Choose Cancel order", body: "Tell us why you are cancelling and confirm." },
              { title: "Receive your refund", body: "What you get back depends on how you paid, as set out below." },
            ],
          },
          {
            kind: "note",
            body: "Cancelling applies to the whole order. Individual items cannot be cancelled separately.",
          },
          "Orders that have not shipped are 100% refundable, with nothing deducted:",
          {
            kind: "list",
            items: [
              `Paid online: the full amount goes back to the payment method you used and reaches you in ${policy.refundDaysMin} to ${policy.refundDaysMax} business days.`,
              "Cash on Delivery: nothing was paid, so there is nothing to refund.",
              "Wallet credit used on the order is returned to your wallet in full.",
              "If we cancel your order, for example because an item is out of stock, you receive the same full refund to the payment method you used.",
            ],
          },
        ],
      },
    ]
  : [];

const sections: LegalSection[] = [
  ...cancelSections,
  {
    id: "after-shipping",
    heading: "If your order has already shipped",
    blocks: [
      ...(canCancel
        ? ["Once the shipment has been created, the order can no longer be cancelled from your account, and the Cancel button is switched off."]
        : []),
      <>
        If your parcel is on its way and you no longer want it, refuse the delivery at your door. The parcel comes
        back to us, we reverse the sale with a GST credit note, and we refund what you paid less the ₹{fee} reverse
        logistics fee (18% GST included), which covers the return freight.
      </>,
      {
        kind: "note",
        title: "Cash on Delivery orders",
        body: "You paid nothing, so there is nothing to refund. The Cash on Delivery charge is not refunded once delivery has been attempted.",
      },
      <>
        If the parcel has been delivered, the <TextLink href="#returns">return</TextLink> terms apply for{" "}
        {policy.returnDays} days and the <TextLink href="#exchanges">exchange</TextLink> terms for{" "}
        {policy.exchangeDays} days.
      </>,
    ],
  },
  {
    id: "returns",
    heading: `Returns within ${policy.returnDays} days, exchanges within ${policy.exchangeDays} days`,
    blocks: [
      `Delivered items can be returned within ${policy.returnDays} days of delivery and exchanged within ${policy.exchangeDays} days of delivery. The days are counted from the date the courier marks your parcel as delivered.`,
      "To qualify for a return or an exchange, the item must come back:",
      {
        kind: "list",
        items: [
          "In its original condition: unworn and unaltered.",
          "With all original packaging, tags, and warranty and authenticity cards.",
          "With any promotional gifts that came with the order, such as the complimentary tote bag or silver coins.",
        ],
      },
      {
        kind: "note",
        tone: "important",
        title: "Returns are settled as store credit. No Cash Refunds.",
        body: (
          <>
            Delivered items are returned for EYRA store credit, not cash. Exchanges for a different size or design are
            free.
            {canCancel ? (
              <>
                {" "}Orders that have not shipped are different: they are{" "}
                <TextLink href="#cancel">refunded in full</TextLink> to your payment method.
              </>
            ) : null}
          </>
        ),
      },
    ],
  },
  {
    id: "exchanges",
    heading: "How exchanges work",
    blocks: [
      `You can exchange a piece for a different size or design within ${policy.exchangeDays} days of delivery. There is no fee for an exchange: we collect the item you are sending back and deliver your replacement without charging for pickup or delivery.`,
      "If the replacement has a different price:",
      {
        kind: "cards",
        items: [
          {
            title: "It costs more",
            body: "We send you a secure Razorpay payment link for the difference only, and book the pickup as soon as it is paid.",
          },
          {
            title: "It costs the same or less",
            body: `Nothing is due and the pickup is booked straight away. If it costs less, the difference is added to your wallet as store credit, ${creditValidity}.`,
          },
        ],
      },
      "When the item reaches us and passes the quality check, we send your replacement without any further payment from you. The replacement appears as its own order in your account with its own tax invoice, and the item you sent back gets a GST credit note.",
    ],
  },
  {
    id: "how-to",
    heading: "How to start a return or exchange",
    blocks: [
      {
        kind: "steps",
        items: [
          {
            title: "Open the order in your account",
            body: "The Return and Exchange options appear once the order has been delivered.",
          },
          {
            title: "Choose Return or Exchange",
            body: "Select the item and pick a reason: size issue, design preference, damaged in transit, or defective. For an exchange, also pick the size or design you want.",
          },
          {
            title: "Pay any price difference (exchanges only)",
            body: "Only if your replacement costs more. You will receive a secure payment link.",
          },
          {
            title: "We book the pickup",
            body: "We book the courier and email you the pickup details.",
          },
          {
            title: "Hand over the parcel",
            body: "Pack the jewellery securely in its original box and hand it to the courier agent.",
          },
        ],
      },
      <>
        Prefer not to use your account? Email {orders} with your order number and we will open the request for you.
      </>,
    ],
  },
  {
    id: "pickup",
    heading: "Reverse pickup and remote PIN codes",
    blocks: [
      "Once a return is booked, our courier partner will attempt a reverse pickup from your address. Please be available to hand over the parcel and to answer the agent's verification call.",
      <>
        If a pickup cannot be arranged from your PIN code, email {orders} with your order number and we will arrange
        the return with you.
      </>,
    ],
  },
  {
    id: "inspection",
    heading: "Quality check and deductions",
    blocks: [
      "Every returned item goes through a quality check at our fulfilment centre, where we confirm the purity marks, weight, and condition.",
      "If an approved return arrives with missing components or broken tags, or without the promotional items it was shipped with (such as silver coins or branded accessories), we may deduct the full retail price of the missing items from your credit.",
      "If an item does not pass the check, we email you the reason and no credit is added.",
    ],
  },
  {
    id: "settlement",
    heading: "How your store credit is calculated",
    blocks: [
      `When a returned item passes the quality check, we add store credit to your EYRA wallet for what you paid for it, less a flat ₹${fee} reverse logistics fee, and let you know by WhatsApp and email. This is normally within ${policy.dispatchHoursMin} to ${policy.dispatchHoursMax} hours of the item reaching us.`,
      {
        kind: "example",
        title: "Example: returning a ring",
        rows: [
          { label: "You paid for the ring", value: inr(1499) },
          { label: "Reverse logistics fee", value: `− ₹${fee}` },
        ],
        total: { label: "Store credit added", value: inr(1499 - policy.reverseLogisticsFee) },
      },
      {
        kind: "list",
        items: [
          `The ₹${fee} fee is charged once per return, however many items it contains, and includes 18% GST.`,
          "There is no fee when the return is for a damaged or defective item: you get back the full amount you paid.",
          "What you paid for an item is its price after its share of any discount code on the order, including GST. Changes in precious metal rates or later price promotions do not change it.",
          "Cash on Delivery charges are not credited once the parcel has been delivered.",
          "We also issue a GST credit note for the returned items, naming the invoice it reverses. You can download it from the order page.",
        ],
      },
    ],
  },
  {
    id: "wallet",
    heading: "Using your wallet credit",
    blocks: [
      "Wallet credit comes from a return or exchange that passed our quality check, or from wallet credit you used on an order that was later cancelled. You can use it at checkout on any order and pay any remaining amount in your usual way.",
      policy.walletCreditMonths > 0
        ? `Credit is valid for ${policy.walletCreditMonths} months from the day it is added, and the credit that expires first is used first. Expired credit can no longer be used. The Wallet page in your account shows your balance and when each credit expires.`
        : "Credit does not expire. The Wallet page in your account shows your balance.",
      {
        kind: "note",
        body: "Wallet credit can only be used for purchases on EYRA. It cannot be withdrawn as cash, paid into a bank account, or transferred to another account.",
      },
    ],
  },
  {
    id: "non-returnable",
    heading: "Items that cannot be returned",
    blocks: [
      "Some items cannot be taken back, either because they were made specifically for you or for hygiene reasons:",
      {
        kind: "list",
        items: [
          "Custom-engraved or personalised jewellery.",
          "Pierced body jewellery and earrings, for hygiene reasons, unless they arrive damaged or defective.",
          "Silver coins, puja articles, and anything marked Clearance or Final Sale.",
        ],
      },
    ],
  },
  {
    id: "damage",
    heading: "Damaged, tampered, or missing items",
    blocks: [
      <>
        High-value shipments are sealed in tamper-evident packaging. If your package arrives damaged, opened, or
        empty, email {orders} with your order number within {policy.damageClaimHours} hours of delivery.
      </>,
      {
        kind: "note",
        tone: "important",
        title: "An unboxing video is required",
        body: "To process any claim for theft, a missing item, or transit damage, we need a continuous, unedited 360-degree unboxing video. It must clearly show the intact courier packet, the label barcode, the seal being opened, and the contents inside. Claims without a valid video, or that show signs of tampering after delivery, cannot be processed.",
      },
    ],
  },
  {
    id: "third-party",
    heading: "Purchases made elsewhere",
    blocks: [
      "This policy covers purchases made directly on the official EYRA store at eyra.org.in. Items bought through third-party marketplaces or partner pop-ups follow those sellers' own return processes.",
    ],
  },
  {
    id: "dispatch",
    heading: "Dispatch and shipping",
    blocks: [
      {
        kind: "details",
        items: [
          {
            label: "In-stock orders",
            value: `Dispatched within ${policy.dispatchHoursMin} to ${policy.dispatchHoursMax} hours`,
          },
          {
            label: "Personalised pieces",
            value: `An additional ${policy.customExtraDaysMin} to ${policy.customExtraDaysMax} working days`,
          },
          { label: "Prepaid orders", value: "Free shipping across India, no minimum order value" },
          { label: "Cash on Delivery", value: `₹${COD_CHARGE} charge, shown at checkout before you order` },
          { label: "Tracking", value: "Updates by SMS, WhatsApp, and email once the courier has your parcel" },
        ],
      },
      ...(canCancel
        ? [`The cancellation hold, the first ${cancelWindow} after you order, is part of the dispatch time, not added to it.`]
        : []),
      "If an order mixes ready-to-wear and personalised pieces, we may split the shipment so your ready-to-wear items are not held back.",
      <>
        Full details are in our <TextLink href="/shipping-policy">Shipping and Delivery Policy</TextLink>.
      </>,
    ],
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalDocument
      eyebrow="Customer care"
      title="Returns, Exchanges and Refunds"
      standfirst={
        canCancel
          ? "Jewellery is personal, and we want you to feel confident about every purchase. Here is how to cancel an order or send a piece back, and what happens next."
          : "Jewellery is personal, and we want you to feel confident about every purchase. Here is how to send a piece back, and what happens next."
      }
      updated="November 2026"
      highlights={highlights}
      sections={sections}
      help={{
        title: "Questions about an order?",
        body: (
          <>
            Email {orders} with your order number and we will help.
            <br />
            <span className="text-[13px] text-[#BCBCBC]">
              {seller.legalName}, {seller.addressLine1}, {seller.city}, {seller.state} {seller.pincode}, India
            </span>
          </>
        ),
      }}
    />
  );
}

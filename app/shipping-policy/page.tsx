import type { Metadata } from "next";
import { LegalDocument, TextLink, type LegalSection } from "@/components/layout/LegalDocument";
import { storeConfig } from "@/config/storeConfig";
import { COD_CHARGE, TOTE_MIN_SUBTOTAL } from "@/config/offers";
import { describeWindow } from "@/lib/cancellation";

export const metadata: Metadata = {
  title: "Shipping and Delivery Policy",
  description:
    "Dispatch times, courier partners, delivery timelines, shipping charges, transit insurance, invoices, and live order tracking for EYRA orders across India.",
};

const { contact, policy, seller } = storeConfig;

// Cancelling is only offered when a cancel window is set, so its text follows that setting.
const canCancel = policy.cancelWindowMinutes > 0;
const cancelWindow = describeWindow(policy.cancelWindowMinutes);
const fee = policy.reverseLogisticsFee.toLocaleString("en-IN");

const orders = <TextLink href={`mailto:${contact.ordersEmail}`} />;

const sections: LegalSection[] = [
  {
    id: "dispatch",
    heading: "Order processing and dispatch",
    blocks: [
      `In-stock orders are prepared and dispatched within ${policy.dispatchHoursMin} to ${policy.dispatchHoursMax} hours of payment confirmation.`,
      `Personalised, engraved, or custom-made designs need an additional ${policy.customExtraDaysMin} to ${policy.customExtraDaysMax} working days to craft. If your order contains both ready-to-wear and personalised jewellery, we may split the shipment so your ready-to-wear pieces are not held back.`,
      ...(canCancel
        ? [
            {
              kind: "note" as const,
              title: "The cancellation hold",
              body: `Every order is held for the first ${cancelWindow} so you can still cancel it from your account. This time is part of the dispatch time above, not added to it. When it ends, we create your shipment: a courier is booked, the label is generated, and a pickup is requested. From then on the order can no longer be cancelled, and the tracking details appear on your order page.`,
            },
          ]
        : []),
    ],
  },
  {
    id: "timelines",
    heading: "Delivery timelines",
    blocks: [
      "Delivery times are counted from dispatch, not from when you place the order.",
      {
        kind: "details",
        items: [
          { label: "Metro cities", value: `${policy.metroDaysMin} to ${policy.metroDaysMax} business days` },
          { label: "Rest of India", value: `${policy.indiaDaysMin} to ${policy.indiaDaysMax} business days` },
          { label: "Remote PIN codes", value: "Can take longer, as can deliveries during festivals or bad weather" },
        ],
      },
    ],
  },
  {
    id: "charges",
    heading: "Shipping charges",
    blocks: [
      {
        kind: "cards",
        items: [
          {
            title: "Prepaid orders: free",
            body: "Standard delivery is free across India on every prepaid order. There is no minimum order value and no code needed: it is applied automatically at checkout.",
          },
          {
            title: `Cash on Delivery: ₹${COD_CHARGE}`,
            body: "A one-time Cash on Delivery charge, shown at checkout before you place the order. It includes 18% GST. Choose a prepaid payment method and it is removed.",
          },
        ],
      },
    ],
  },
  {
    id: "tote",
    heading: "Complimentary tote bag",
    blocks: [
      `Complimentary promotional tote bag included with orders above ₹${TOTE_MIN_SUBTOTAL.toLocaleString("en-IN")}.`,
      "The tote bag is a gift with the order. It is added to your order at no charge, packed with your parcel, and shown on your invoice as a free item.",
      "The order value for this offer is the price of your items before any discount, excluding shipping.",
    ],
  },
  {
    id: "couriers",
    heading: "Courier partners",
    blocks: [
      "Orders ship with express courier partners including Blue Dart, Delhivery, and DTDC, coordinated through Shiprocket. Your parcel is assigned to whichever network serves your PIN code fastest.",
    ],
  },
  {
    id: "tracking",
    heading: "Order tracking",
    blocks: [
      {
        kind: "steps",
        items: [
          {
            title: "Shipment created",
            body: "Tracking details appear on the order page in your account.",
          },
          {
            title: "Handed to the courier",
            body: "You receive a live AWB tracking link by email, SMS, and WhatsApp.",
          },
          {
            title: "On its way",
            body: "Live courier status updates on your order page each time the courier scans the parcel.",
          },
        ],
      },
      {
        kind: "note",
        body: "Tracking can take a few hours to start updating after dispatch. This is normal and does not mean the parcel is lost.",
      },
    ],
  },
  {
    id: "insurance",
    heading: "Transit insurance and damaged parcels",
    blocks: [
      "All shipments are 100 percent insured against loss or damage in transit. High-value jewellery is sealed in tamper-evident packaging before it leaves us.",
      {
        kind: "note",
        tone: "important",
        title: "If a parcel arrives open, damaged, or tampered with",
        body: (
          <>
            Refuse the delivery where you can, and tell us within {policy.damageClaimHours} hours by emailing {orders}.
            We need an unboxing video to process a transit claim; see{" "}
            <TextLink href="/refund-policy#damage">what the video must show</TextLink>.
          </>
        ),
      },
    ],
  },
  {
    id: "invoice",
    heading: "Your invoice",
    blocks: [
      "We issue your GST tax invoice when your order is dispatched, not when you pay. Until then, your account shows an order receipt, which the tax invoice replaces once the order ships. You can view and print either one from the order in your account.",
      {
        kind: "list",
        items: [
          "If an order is cancelled before it ships, no tax invoice is issued for it.",
          "A complimentary tote bag appears on the invoice as a free item.",
          "If items are returned or exchanged, an order is cancelled after it has shipped, or a delivery is refused, we issue a GST credit note against the invoice. You can download it from the order page.",
        ],
      },
    ],
  },
  {
    id: "failed-delivery",
    heading: "Failed deliveries and address changes",
    blocks: [
      "Couriers attempt delivery up to three times. Please keep the phone number on your order reachable: most failed deliveries are caused by an unanswered verification call.",
      <>
        If you refuse a delivery, or the courier cannot deliver and the parcel comes back to us, we reverse the sale
        with a credit note and refund what you paid, less a ₹{fee} reverse logistics fee (see our{" "}
        <TextLink href="/refund-policy#after-shipping">Returns, Exchanges and Refunds policy</TextLink>). The Cash on
        Delivery charge is not refunded once delivery has been attempted.
      </>,
      canCancel ? (
        <>
          A delivery address can only be changed before the shipment is created, within the first {cancelWindow} after
          you order, so email {orders} straight away with your order number. The quickest fix for a wrong address is
          to <TextLink href="/refund-policy#cancel">cancel the order</TextLink> from your account while you still can,
          which refunds the full amount, and place it again with the correct address. Once the courier has the parcel,
          the address cannot be changed.
        </>
      ) : (
        <>
          A delivery address can only be changed before dispatch, so email {orders} as soon as you notice. Once the
          courier has the parcel, the address cannot be changed.
        </>
      ),
    ],
  },
];

export default function ShippingPolicyPage() {
  return (
    <LegalDocument
      eyebrow="Customer care"
      title="Shipping and Delivery Policy"
      standfirst="How quickly we dispatch, who carries your parcel, what it costs, and how to track it."
      updated="November 2026"
      highlights={[
        { label: "Dispatch", value: `${policy.dispatchHoursMin}–${policy.dispatchHoursMax} hrs`, note: "for in-stock orders" },
        { label: "Metro cities", value: `${policy.metroDaysMin}–${policy.metroDaysMax} days`, note: "business days from dispatch" },
        { label: "Rest of India", value: `${policy.indiaDaysMin}–${policy.indiaDaysMax} days`, note: "business days from dispatch" },
        { label: "Shipping", value: "Free", note: `on prepaid orders; ₹${COD_CHARGE} for Cash on Delivery` },
      ]}
      sections={sections}
      help={{
        title: "Where is my order?",
        body: (
          <>
            For anything about an order, including shipping, cancelling, and returns, email {orders} with your order
            number and we will follow up with the courier for you.
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

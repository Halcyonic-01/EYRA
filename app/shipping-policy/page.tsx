import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";
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

export default function ShippingPolicyPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Shipping and Delivery Policy"
      standfirst="How quickly we dispatch, who carries your parcel, what it costs, and how you track it."
      updated="October 2026"
      sections={[
        {
          heading: "1. Order processing and dispatch",
          body: [
            `Standard in-stock orders are prepared and dispatched within ${policy.dispatchHoursMin} to ${policy.dispatchHoursMax} hours of payment confirmation.`,
            `Complimentary promotional tote bag included with orders above ₹${TOTE_MIN_SUBTOTAL.toLocaleString("en-IN")}; subject to stock availability.`,
            "The tote bag is a gift with the order. It is added to your order at no charge and is packed with your parcel. The order value for this offer is the price of your items before any discount, without shipping.",
            `Personalised, engraved, or custom-made designs need an additional ${policy.customExtraDaysMin} to ${policy.customExtraDaysMax} working days for craftsmanship. If your order contains both standard and personalised jewellery, we may split the shipment so your ready-to-wear pieces are not held back.`,
            ...(canCancel
              ? [
                  `Every order is held for the first ${cancelWindow} so that you can still cancel it from your account. That time is part of the dispatch time above, not added to it. When it ends, we create your shipment: a courier is booked, the shipping label is generated, and a pickup is requested. From then on the order can no longer be cancelled, and your tracking details appear on the order page.`,
                ]
              : []),
          ],
        },
        {
          heading: "2. Courier partners",
          body: [
            "Orders ship through express courier partners including Blue Dart, Delhivery, and DTDC, coordinated via Shiprocket. The partner assigned to your parcel depends on which network services your PIN code fastest.",
          ],
        },
        {
          heading: "3. Delivery timelines",
          body: [
            "Timelines below run from dispatch, not from the moment you order.",
          ],
          bullets: [
            `Metro cities: ${policy.metroDaysMin} to ${policy.metroDaysMax} business days.`,
            `Rest of India: ${policy.indiaDaysMin} to ${policy.indiaDaysMax} business days.`,
            "Remote PIN codes, and deliveries during festivals or heavy weather, can take longer.",
          ],
        },
        {
          heading: "4. Shipping charges",
          body: [
            "Standard delivery is free across India on every prepaid order. There is no minimum order value, and you do not need a code: it is applied automatically at checkout.",
            `Cash on Delivery orders carry a ₹${COD_CHARGE} Cash on Delivery charge, added once and shown at checkout before you place the order, and it includes 18% GST. Choose a prepaid payment method and it comes off.`,
          ],
        },
        {
          heading: "5. Transit insurance",
          body: [
            "All shipments are 100 percent insured against loss or damage in transit. High-value jewellery is sealed in tamper-evident packaging before it leaves us.",
            `If a parcel arrives open, damaged, or visibly tampered with, refuse the delivery where you can and tell us within ${policy.damageClaimHours} hours by emailing ${contact.ordersEmail}. Our returns policy sets out the unboxing video we need to process a transit claim.`,
          ],
        },
        {
          heading: "6. Order tracking",
          body: [
            "Your tracking details appear on the order page in your account as soon as your shipment is created, and live courier status follows once the courier scans the parcel.",
            "As soon as your parcel is handed to the courier, you also receive a live AWB tracking link by email, SMS, and WhatsApp. Tracking can take a few hours to start updating after dispatch, which is normal and does not mean the parcel is lost.",
          ],
        },
        {
          heading: "7. Your invoice",
          body: [
            "We issue your GST tax invoice when your order is dispatched, not when you pay. Until then, your account shows an order receipt for the order, and the tax invoice replaces it once the order ships.",
            "You can view and print the receipt or the invoice from the order in your account. If an order is cancelled before it ships, no tax invoice is issued for it. A complimentary tote bag appears on the invoice as a free line.",
            "If items are returned or exchanged, or an order is cancelled after it shipped or a delivery is refused, we issue a GST credit note against the invoice. It appears on the order page, where you can download it.",
          ],
        },
        {
          heading: "8. Failed deliveries and address changes",
          body: [
            "Couriers attempt delivery up to three times. Please keep the phone number on your order reachable, since most failed deliveries are caused by an unanswered verification call.",
            "If you refuse a delivery, or the courier cannot deliver and the parcel comes back to us, we reverse the sale with a credit note and refund what you paid, less a ₹99 reverse logistics fee (see our Returns, Exchanges and Refunds policy). The Cash on Delivery charge is not refunded once delivery was attempted.",
            canCancel
              ? `We can only change a delivery address before the shipment is created, which is within the first ${cancelWindow} after you order, so email ${contact.ordersEmail} straight away with your order number. The quickest fix for a wrong address is to cancel the order from your account while you still can, choose the wallet refund to get the full amount back, and place the order again with the right address. Once the courier has the parcel, the address is fixed.`
              : `We can only change a delivery address before dispatch, so email ${contact.ordersEmail} as soon as you notice. Once the courier has the parcel, the address is fixed.`,
          ],
        },
        {
          heading: "9. Questions",
          body: [
            `For anything about an order, including shipping, cancelling, and returns, email ${contact.ordersEmail} with your order number and we will chase the courier on your behalf.`,
            `${seller.legalName}, ${seller.addressLine1}, ${seller.city}, ${seller.state} ${seller.pincode}, India.`,
          ],
        },
      ]}
    />
  );
}

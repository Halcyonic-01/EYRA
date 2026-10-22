import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";
import { storeConfig } from "@/config/storeConfig";
import { COD_CHARGE } from "@/config/offers";
import { describeWindow } from "@/lib/cancellation";

export const metadata: Metadata = {
  title: "Returns, Exchanges and Refunds",
  description:
    "How to cancel an order before it ships, what to do once it has shipped, EYRA's 7-day return and exchange terms, how returns are settled as store credit, reverse pickup, and what we need to process a transit damage claim.",
};

const { contact, policy, seller } = storeConfig;

const fee = policy.reverseLogisticsFee.toLocaleString("en-IN");

// Cancelling is only offered when a cancel window is set, so its text follows that setting.
const canCancel = policy.cancelWindowMinutes > 0;
const cancelWindow = describeWindow(policy.cancelWindowMinutes);
const walletSection = canCancel ? "12" : "11";

export default function RefundPolicyPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Returns, Exchanges and Refunds"
      standfirst={
        canCancel
          ? "Jewellery is personal, and we want you confident with every purchase. Here is exactly how to cancel an order or send a piece back, and what happens next."
          : "Jewellery is personal, and we want you confident with every purchase. Here is exactly how to send a piece back and what happens next."
      }
      updated="October 2026"
      sections={[
        {
          heading: "1. Shipping and order dispatch",
          body: [
            `Standard in-stock orders are dispatched within ${policy.dispatchHoursMin} to ${policy.dispatchHoursMax} hours. Personalised or custom-made designs need an additional ${policy.customExtraDaysMin} to ${policy.customExtraDaysMax} working days. Where an order mixes both, we may split the shipment so your ready-to-wear items arrive without delay.`,
            ...(canCancel
              ? [
                  `Every order is held for the first ${cancelWindow} so that you can still cancel it (see section 11). That time is part of the dispatch time above, not added to it.`,
                ]
              : []),
            `Shipping is free across India on every prepaid order, with no minimum order value. Cash on Delivery orders carry a ₹${COD_CHARGE} Cash on Delivery charge, shown at checkout before you place the order.`,
            "Once your parcel reaches our logistics partner, you receive automated tracking notifications by SMS, WhatsApp, and email.",
          ],
        },
        {
          heading: `2. ${policy.returnDays}-day return and exchange window`,
          body: [
            `Delivered items can be returned or exchanged within ${policy.returnDays} days of delivery. The ${policy.returnDays} days start from the date the courier marks your parcel delivered.`,
            "To qualify, the jewellery must be in its original, unworn, and unaltered condition, and must come back with all original packaging, tags, warranty and authenticity cards, and any promotional gifts, such as the complimentary tote bag or silver coins, included with the order.",
            `Returns are settled as store credit, not cash: Free ${policy.returnDays}-Day Easy Exchanges & Store Credit Returns. No Cash Refunds. Orders that have not shipped are different: they are refunded in full (see the section on cancelling).`,
          ],
        },
        {
          heading: "3. Non-returnable and final sale items",
          body: [
            "Some items cannot be taken back because they were made for you specifically or cannot be resold on hygiene grounds.",
          ],
          bullets: [
            "Custom-engraved or personalised jewellery.",
            "Pierced body jewellery and earrings, on hygiene grounds, unless received damaged or defective.",
            "Silver coins, puja articles, and anything marked Clearance or Final Sale.",
          ],
        },
        {
          heading: "4. Purchases made through third parties",
          body: [
            "This policy covers purchases made directly on the official EYRA store at eyra.org.in. Items bought through third-party marketplaces or partner pop-ups are governed by those channels' own return processes.",
          ],
        },
        {
          heading: "5. Returns inspection and deductions",
          body: [
            "Every returned item goes through a mandatory quality assessment at our fulfilment centre, where we confirm purity marks, weight, and condition.",
            "If an approved return arrives with missing components, broken tags, or without the promotional items it shipped with, such as silver coins or branded accessories, we reserve the right to deduct the full retail price of the missing items from your credit.",
          ],
        },
        {
          heading: "6. How returns are settled",
          body: [
            `When a returned item reaches us and passes the quality check, we add store credit to your EYRA wallet for what you paid for it, less a flat ₹${fee} reverse logistics fee, and send you a WhatsApp message and an email. For example, a ring you paid ₹1,499 for gives ₹1,400 of store credit. The ₹${fee} is charged once for each return, however many items are in it, and includes 18% GST.`,
            "There is no fee when the return is for a damaged or defective item (reasons: damaged in transit, defective): you get back the full amount you paid.",
            `We add the credit as soon as the item passes inspection, normally within ${policy.dispatchHoursMin} to ${policy.dispatchHoursMax} hours of it reaching us. If an item fails the check, we email you the reason and nothing is added to your wallet.`,
            "What you paid for an item is its price after its share of any discount code on the order, with GST included. Precious metal rate movements and later promotional price changes do not change it. Cash on Delivery charges are not credited once your parcel has been delivered.",
            "We also issue you a GST credit note for the returned items. It names the invoice it reverses, and you can download it from the order page.",
            `Store credit is valid for ${policy.walletCreditMonths} months and works on your next order. Section ${walletSection} explains how wallet credit works.`,
          ],
        },
        {
          heading: "7. Exchanges",
          body: [
            `You can exchange a piece for a different size or design within ${policy.exchangeDays} days of delivery. Choose Exchange on the order in your account, pick the item and the size or design you want, and tell us why.`,
            "There is no fee for an exchange. We collect the item you are returning and send your replacement without charging for pickup or delivery.",
            "If the replacement costs more than what you paid for the item you are returning, we send you a secure Razorpay payment link for the difference only, and book the pickup as soon as it is paid. If it costs the same or less, nothing is due and the pickup is booked straight away.",
            "When the item reaches us and passes the quality check, we send your replacement without any further payment from you.",
            "If the replacement costs less than what you paid, we add the difference to your wallet as store credit, valid for 12 months.",
            "Your replacement is shown as its own order in your account, and gets its own tax invoice. The item you sent back gets a GST credit note.",
          ],
        },
        {
          heading: "8. Reverse pickup and remote PIN codes",
          body: [
            "Once a return is booked, our courier partner attempts a reverse pickup from your address. Please be available to hand over the parcel and to answer the agent's verification call.",
            `Where a rural or non-standard PIN code is not reverse-serviceable, we will ask you to send the package via a reliable tracked service such as India Post Speed Post. We reimburse return postage up to ₹${policy.selfShipReimbursement} against a valid courier receipt. Any amount beyond that is borne by the customer.`,
          ],
        },
        {
          heading: "9. Transit damage, tampered parcels, and missing items",
          body: [
            `High-value shipments are sealed in tamper-evident packaging. If you receive a compromised, empty, or damaged package, notify us within ${policy.damageClaimHours} hours of delivery by emailing ${contact.ordersEmail} with your order number.`,
            "A continuous, unedited 360-degree unboxing video is required to process any theft, missing-item, or transit-damage claim. It must clearly show the intact courier flyer, the label barcode, the seal being opened, and the contents inside.",
            "Claims without valid video verification, or showing signs of post-delivery tampering, cannot be processed.",
          ],
        },
        {
          heading: "10. How to start a return or exchange",
          body: [
            "Open the order in your account, choose Return or Exchange, select the item, and pick a reason: size issue, design preference, damaged in transit, or defective. The option appears once your order has been delivered and stays for 7 days.",
            "For a return, we book the courier right away and email you the pickup details. For an exchange we do the same, after you have paid any price difference. Pack the jewellery securely in its original box and hand it to the courier agent at pickup.",
            `For any question about an order, or if you would rather not use the account flow, email ${contact.ordersEmail} with your order number and we will open the request for you.`,
            `${seller.legalName}, ${seller.addressLine1}, ${seller.city}, ${seller.state} ${seller.pincode}, India.`,
          ],
        },
        ...(canCancel
          ? [
              {
                heading: "11. Cancelling an order, and orders already on their way",
                body: [
                  `Before it ships. You can cancel an order yourself for ${cancelWindow} after you place it. Open the order in your account and choose Cancel order. We hold every order for that time before creating its shipment, so a cancelled order is never sent. Cancelling cancels the whole order; individual items cannot be cancelled separately.`,
                  "Unshipped orders are 100% refundable, with nothing deducted. What you get back:",
                ],
                bullets: [
                  `Paid online: the full amount is refunded to the payment method you paid with, and reaches you in ${policy.refundDaysMin} to ${policy.refundDaysMax} business days.`,
                  "Cash on delivery: nothing was paid, so there is nothing to refund.",
                  "Any wallet credit you used on the order is returned to your wallet in full.",
                  `If we cancel your order, for example because an item is out of stock, you get the same: a full refund to the payment method you used.`,
                ],
              },
              {
                heading: "11A. After it has shipped",
                body: [
                  "Once the shipment has been created, the order can no longer be cancelled from your account, and the Cancel button is switched off.",
                  `If your parcel is on its way and you no longer want it, refuse the delivery at your door. The parcel comes back to us. We then reverse the sale with a GST credit note and refund what you paid, less the ₹${fee} reverse logistics fee (18% GST included) that covers the return freight. If you paid by Cash on Delivery you paid nothing, so there is nothing to refund, and the Cash on Delivery charge is not refunded once delivery was attempted.`,
                  `If the parcel was delivered, the return and exchange terms above apply for ${policy.returnDays} days.`,
                  `If you need help, email ${contact.ordersEmail} with your order number.`,
                ],
              },
            ]
          : []),
        {
          heading: `${walletSection}. EYRA wallet credit`,
          body: [
            `Wallet credit comes from a return or exchange that passed our quality check, or from wallet credit you used on an order that was then cancelled. It is added to the wallet in your account, and you can use it at checkout on any order, paying any remaining amount in your usual way.`,
            policy.walletCreditMonths > 0
              ? `Credit is valid for ${policy.walletCreditMonths} months from the day it is added, and the credit that expires first is used first. Expired credit can no longer be used. The Wallet page in your account shows your balance and when each credit expires.`
              : "Credit does not expire. The Wallet page in your account shows your balance.",
            "Wallet credit is for purchases on EYRA only. It cannot be withdrawn as cash, paid into a bank account, or transferred to another account.",
          ],
        },
      ]}
    />
  );
}

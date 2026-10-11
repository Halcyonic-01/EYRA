import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";
import { storeConfig } from "@/config/storeConfig";
import { describeWindow } from "@/lib/cancellation";

export const metadata: Metadata = {
  title: "Returns, Exchanges and Refunds",
  description:
    "How to cancel an order before it ships, EYRA's return and exchange windows, how approved returns are settled as wallet credit, reverse pickup, and what we need to process a transit damage claim.",
};

const { contact, policy, seller } = storeConfig;

const freeShipping = policy.freeShippingAbove.toLocaleString("en-IN");
const cancelFee = policy.cancelFee.toLocaleString("en-IN");

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
            `Standard shipping is free across India on prepaid orders above ₹${freeShipping}. Orders below that carry a nominal handling fee shown at checkout.`,
            "Once your parcel reaches our logistics partner, you receive automated tracking notifications by SMS, WhatsApp, and email.",
          ],
        },
        {
          heading: `2. ${policy.returnDays}-day return window`,
          body: [
            `We offer a hassle-free ${policy.returnDays}-day return window, starting from the exact date of delivery.`,
            "To qualify for a return or exchange, the jewellery must be in its original, unworn, and unaltered condition, and must come back with all original packaging, tags, warranty and authenticity cards, and any promotional gifts or silver coins included with the order.",
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
          heading: "6. How approved returns are settled",
          body: [
            `Once a return or exchange request is approved, the value of the approved items is added to your EYRA wallet as store credit, and we email you when it is added. We add it within ${policy.dispatchHoursMin} to ${policy.dispatchHoursMax} hours after the returned parcel passes inspection.`,
            "If we cannot approve a request, we email you the reason and nothing is added to your wallet.",
            "The credit is based on the net amount you paid for the approved items at checkout. Precious metal rate movements and later promotional price changes do not alter its value. Express shipping charges, where paid, are not credited.",
            `You can use the credit at checkout on your next order. How wallet credit works, including how long it stays valid, is explained in section ${walletSection}.`,
          ],
        },
        {
          heading: "7. Exchanges",
          body: [
            `You can ask to exchange a piece, for example for a different ring or chain size or a substitute model, within ${policy.exchangeDays} days of delivery. Choose Exchange when you raise the request from the order in your account.`,
            "When an exchange is approved, the value of the piece you send back is added to your EYRA wallet as store credit, and you use it to order the size or model you want. If the new piece costs more, you pay the difference at checkout. If it costs less, the rest of the credit stays in your wallet.",
            "The replacement is not dispatched automatically. You place a normal order for it, which is dispatched like any other order.",
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
            "Open the order in your account, choose Return or Exchange, select the items, and tell us why. The option appears once your order has been delivered.",
            "Our team reviews your request and emails you what happens next. Pack the jewellery securely in its original box and hand it to the courier agent at pickup.",
            `For any question about an order, or if you would rather not use the account flow, email ${contact.ordersEmail} with your order number and we will open the request for you.`,
            `${seller.legalName}, ${seller.addressLine1}, ${seller.city}, ${seller.state} ${seller.pincode}, India.`,
          ],
        },
        ...(canCancel
          ? [
              {
                heading: "11. Cancelling an order before it ships",
                body: [
                  `You can cancel an order yourself for ${cancelWindow} after you place it. Open the order in your account, choose Cancel order, and pick how you want to be refunded. We hold every order for that time before creating its shipment, so a cancelled order is never sent.`,
                  "Cancelling cancels the whole order. Individual items cannot be cancelled separately. Once the shipment has been created, the order can no longer be cancelled, and the order page tells you so. After delivery, the return and exchange terms above apply.",
                  `If you need help with a cancellation, email ${contact.ordersEmail} with your order number.`,
                  "What you get back:",
                ],
                bullets: [
                  `Paid online: you choose where the refund goes. Refunded to your EYRA wallet, you get the full amount you paid, added to your wallet straight away. Refunded to your original payment method, you get the amount you paid less a ₹${cancelFee} cancellation fee, and it reaches you in ${policy.refundDaysMin} to ${policy.refundDaysMax} business days. If you paid ₹${cancelFee} or less online, only the wallet option is offered.`,
                  "Cash on delivery: nothing was paid, so there is nothing to refund.",
                  "Any wallet credit you used on the order is returned to your wallet in full.",
                  `If we cancel your order, for example because an item is out of stock, you get a full refund with no cancellation fee. Money paid online goes back to your original payment method in ${policy.refundDaysMin} to ${policy.refundDaysMax} business days.`,
                ],
              },
            ]
          : []),
        {
          heading: `${walletSection}. EYRA wallet credit`,
          body: [
            `Wallet credit comes from an approved return or exchange${canCancel ? ", or from a cancelled order that you chose to have refunded to your wallet" : ""}. It is added to the wallet in your account, and you can use it at checkout on any order, paying any remaining amount in your usual way.`,
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

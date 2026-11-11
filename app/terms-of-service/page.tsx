import type { Metadata } from "next";
import { LegalDocument, TextLink } from "@/components/layout/LegalDocument";
import { storeConfig } from "@/config/storeConfig";
import { describeWindow } from "@/lib/cancellation";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that apply when you browse or buy from EYRA, operated by EYRA JEWELS PRIVATE LIMITED.",
};

const { contact, company, policy, seller } = storeConfig;

const mail = (address: string) => <TextLink href={`mailto:${address}`} />;

export default function TermsOfServicePage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Terms of Service"
      standfirst="These terms apply every time you browse eyra.org.in or place an order with us. Please read them before you buy."
      updated="October 2026"
      sections={[
        {
          id: "legal-entity",
          heading: "Who we are",
          blocks: [
            `This website is operated by ${seller.legalName}, a company incorporated in India.`,
            {
              kind: "details",
              items: [
                { label: "Company", value: seller.legalName },
                { label: "CIN", value: company.cin },
                { label: "Registered office", value: `${seller.addressLine1}, ${seller.city}, ${seller.state}, India ${seller.pincode}` },
              ],
            },
            "By using this site you agree to these terms. If you do not agree with any part of them, please do not use the site.",
          ],
        },
        {
          id: "account",
          heading: "Your account",
          blocks: [
            "You need an account to check out. You are responsible for keeping your sign-in details private and for orders placed through your account.",
            "Tell us straight away if you believe someone else has accessed your account.",
          ],
        },
        {
          id: "pricing",
          heading: "Prices and product information",
          blocks: [
            {
              kind: "list",
              items: [
                "All prices are in Indian Rupees and include GST unless stated otherwise. Where a compare-at price applies, we show it alongside the selling price.",
                "The Cash on Delivery charge includes 18% GST.",
                "We may correct pricing errors, and cancel orders caused by a system error or an obviously incorrect price, at any point before dispatch. If we do, you are refunded in full.",
              ],
            },
            {
              kind: "note",
              title: "About our photographs",
              body: "We photograph our jewellery as accurately as we can, but screens vary and silver catches the light differently in person. Minor variation in finish is a characteristic of handmade work, not a defect.",
            },
          ],
        },
        {
          id: "orders",
          heading: "Orders",
          blocks: [
            "Placing an order is an offer to buy. A contract is formed only when we confirm your order by email. Until then we may decline or cancel an order, for example if an item is out of stock, payment cannot be verified, or we cannot deliver to your address.",
            "We may limit or cancel orders that appear to be placed by resellers or for fraudulent purposes.",
          ],
        },
        {
          id: "payment",
          heading: "Payment",
          blocks: [
            "We accept cards, UPI, net banking, and wallets through Razorpay, and Cash on Delivery where available. Your payment details are handled by our payment provider and are never stored by us.",
            "Cash on Delivery orders may be verified by phone or message before dispatch.",
          ],
        },
        {
          id: "shipping-returns",
          heading: "Shipping, returns, and refunds",
          blocks: [
            <>
              Delivery timelines and charges are set out in our{" "}
              <TextLink href="/shipping-policy">Shipping and Delivery Policy</TextLink>. Returns are accepted within{" "}
              {policy.returnDays} days of delivery and exchanges within {policy.exchangeDays} days, on the conditions in
              our <TextLink href="/refund-policy">Returns, Exchanges and Refunds policy</TextLink>. Both policies form
              part of these terms.
            </>,
            {
              kind: "list",
              items: [
                `Delivered items are returned for EYRA store credit, not cash: the amount you paid, less a flat ₹${policy.reverseLogisticsFee} reverse logistics fee including 18% GST (no fee for a damaged or defective item), valid for ${policy.walletCreditMonths} months.`,
                "Exchanges for another size or design have no fee. If the new piece costs more, you pay the difference.",
                "Orders that have not shipped are 100% refundable to the payment method used.",
                ...(policy.cancelWindowMinutes > 0
                  ? [
                      `You can cancel an order yourself from your account for ${describeWindow(policy.cancelWindowMinutes)} after placing it, until its shipment is created. A cancelled order is refunded in full to the payment method you used.`,
                    ]
                  : []),
                "We issue a GST credit note for items returned, exchanged, or refunded after dispatch.",
              ],
            },
          ],
        },
        {
          id: "warranty",
          heading: "Warranty",
          blocks: [
            `We warrant our jewellery against manufacturing defects for ${policy.warrantyMonths} months from delivery.`,
            {
              kind: "note",
              title: "What the warranty does not cover",
              body: "Ordinary tarnish, scratches, bending, stone loss caused by impact, or damage from chemicals, perfume, or water.",
            },
          ],
        },
        {
          id: "intellectual-property",
          heading: "Intellectual property",
          blocks: [
            `All designs, photography, branding, logos, text, and site code belong exclusively to ${seller.legalName}. They may not be copied, resold, or used commercially without our written permission.`,
          ],
        },
        {
          id: "acceptable-use",
          heading: "Acceptable use",
          blocks: [
            "Do not try to disrupt the site, test it for vulnerabilities without permission, scrape it at scale, or use it to break the law. We may suspend accounts that do.",
          ],
        },
        {
          id: "liability",
          heading: "Liability",
          blocks: [
            "Nothing in these terms limits liability that cannot be limited by law, including for fraud, or for death or personal injury caused by negligence.",
            "Subject to that, our total liability in connection with any order is limited to the amount you paid for that order.",
          ],
        },
        {
          id: "governing-law",
          heading: "Governing law and jurisdiction",
          blocks: [
            `These terms are governed by the laws of India. The courts at ${seller.city}, ${seller.state} have exclusive jurisdiction over any dispute arising from them.`,
          ],
        },
        {
          id: "contact",
          heading: "Grievances and contact",
          blocks: [
            {
              kind: "details",
              items: [
                { label: "Order questions", value: mail(contact.ordersEmail) },
                { label: "General queries", value: mail(contact.supportEmail) },
                { label: "Formal grievances", value: mail(contact.grievanceEmail) },
              ],
            },
            <>
              Our designated officer and response times are set out on our{" "}
              <TextLink href="/grievance-redressal">Grievance Redressal</TextLink> page.
            </>,
          ],
        },
      ]}
    />
  );
}

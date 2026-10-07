import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";
import { storeConfig } from "@/config/storeConfig";
import { describeWindow } from "@/lib/cancellation";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that apply when you browse or buy from EYRA, operated by EYRA JEWELS PRIVATE LIMITED.",
};

const { contact, company, policy, seller } = storeConfig;

export default function TermsOfServicePage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Terms of Service"
      standfirst="These terms apply every time you browse eyra.org.in or place an order with us. Please read them before you buy."
      updated="October 2026"
      sections={[
        {
          heading: "1. Legal entity",
          body: [
            `This website is operated by ${seller.legalName}, a company incorporated in India under CIN ${company.cin}, with its registered office at ${seller.addressLine1}, ${seller.city}, ${seller.state}, India ${seller.pincode}.`,
            "By using this site you agree to these terms. If you do not agree with any part of them, please do not use the site.",
          ],
        },
        {
          heading: "2. Your account",
          body: [
            "You need an account to check out. You are responsible for keeping your sign-in credentials private and for orders placed through your account.",
            "Tell us immediately if you believe someone else has accessed your account.",
          ],
        },
        {
          heading: "3. Product pricing and inaccuracies",
          body: [
            "All prices are in Indian Rupees and include GST unless stated otherwise. We show a compare-at price alongside the selling price where one applies.",
            "We reserve the right to correct pricing errors and to cancel orders that result from a system glitch or an obviously incorrect price, at any point before dispatch. Where we do, you are refunded in full.",
            "We photograph our jewellery as accurately as we can, but screens vary and silver catches light differently in person. Minor variation in finish is a characteristic of handmade work, not a defect.",
          ],
        },
        {
          heading: "4. Orders",
          body: [
            "Your order is an offer to buy. A contract forms only when we confirm the order by email. Until then we may decline or cancel an order, for example where an item is out of stock, payment cannot be verified, or we cannot deliver to your address.",
            "We may limit or cancel orders that appear to be placed by resellers or for fraudulent purposes.",
          ],
        },
        {
          heading: "5. Payment",
          body: [
            "We accept cards, UPI, net banking, and wallets through Razorpay, and cash on delivery where available. Payment credentials are handled by our payment provider and are never stored by us.",
            "Cash on delivery orders may be verified by phone or message before dispatch.",
          ],
        },
        {
          heading: "6. Shipping, returns, and refunds",
          body: [
            `Delivery timelines, charges, and the free-shipping threshold are set out in our Shipping and Delivery Policy. Returns and exchanges are accepted within ${policy.returnDays} days of delivery on the conditions set out in our Returns, Exchanges and Refunds policy.`,
            ...(policy.cancelWindowMinutes > 0
              ? [
                  `You can cancel an order yourself from your account for ${describeWindow(policy.cancelWindowMinutes)} after you place it, until its shipment is created. How cancellations, returns, and exchanges are refunded, including through EYRA wallet credit, is set out in our Returns, Exchanges and Refunds policy.`,
                ]
              : []),
            "Both policies form part of these terms.",
          ],
        },
        {
          heading: "7. Warranty",
          body: [
            `We warrant our jewellery against manufacturing defects for ${policy.warrantyMonths} months from delivery. The warranty does not cover ordinary tarnish, scratches, bending, stone loss caused by impact, or damage from chemicals, perfume, or water exposure.`,
          ],
        },
        {
          heading: "8. Intellectual property",
          body: [
            `All designs, photography, branding, logo assets, copy, and site code are the exclusive property of ${seller.legalName}. They may not be copied, resold, or used commercially without written permission.`,
          ],
        },
        {
          heading: "9. Acceptable use",
          body: [
            "Do not attempt to disrupt the site, probe it for vulnerabilities without permission, scrape it at scale, or use it to break the law. We may suspend accounts that do.",
          ],
        },
        {
          heading: "10. Liability",
          body: [
            "Nothing in these terms limits liability that cannot be limited by law, including for fraud or for death or personal injury caused by negligence.",
            "Subject to that, our total liability in connection with any order is limited to the amount you paid for that order.",
          ],
        },
        {
          heading: "11. Governing law and jurisdiction",
          body: [
            `These terms are governed by the laws of India. The courts at ${seller.city}, ${seller.state} have exclusive jurisdiction over any dispute arising from them.`,
          ],
        },
        {
          heading: "12. Grievances and contact",
          body: [
            `For questions about an order, write to ${contact.ordersEmail}. For general queries write to ${contact.supportEmail}. For formal grievances, our designated officer and the applicable service levels are set out on our Grievance Redressal page, and can be reached at ${contact.adminEmail}.`,
          ],
        },
      ]}
    />
  );
}

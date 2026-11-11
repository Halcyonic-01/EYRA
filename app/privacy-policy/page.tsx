import type { Metadata } from "next";
import { LegalDocument, TextLink } from "@/components/layout/LegalDocument";
import { storeConfig } from "@/config/storeConfig";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How EYRA JEWELS PRIVATE LIMITED collects, uses, processes, and protects your personal information under the IT Act and the DPDP Act.",
};

const { contact, company, policy, seller } = storeConfig;

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Privacy Policy"
      standfirst={`How ${seller.legalName} collects, uses, and protects your personal information when you visit, create an account on, or buy from eyra.org.in.`}
      updated="August 2026"
      sections={[
        {
          id: "commitment",
          heading: "Our commitment",
          blocks: [
            "We are committed to keeping your data confidential and accurate in line with applicable data protection law, including the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data Protection Act.",
            {
              kind: "note",
              title: "We do not sell your data",
              body: "We do not sell, rent, or trade your personal data. We share it only with the service providers listed below, to run the store and deliver your orders.",
            },
          ],
        },
        {
          id: "collected-automatically",
          heading: "Information collected automatically",
          blocks: [
            "When you browse the store, our servers record technical information about your visit:",
            {
              kind: "details",
              items: [
                { label: "Device details", value: "IP address, operating system, browser type, device category, screen resolution, and time zone." },
                { label: "Browsing activity", value: "Pages visited, collections and products viewed, referring and exit URLs, search keywords, and interaction times." },
                { label: "Cookies", value: "Small files stored by your browser for session management, keeping your cart, and keeping you signed in." },
                { label: "Logs and web beacons", value: "Records of site events, server response times, and traffic flow." },
                { label: "Analytics", value: "Anonymised data used to find broken parts of the site and improve checkout performance." },
              ],
            },
          ],
        },
        {
          id: "you-provide",
          heading: "Information you give us",
          blocks: [
            "When you create an account, check out, or contact customer care, we collect:",
            {
              kind: "details",
              items: [
                { label: "Identity and contact", value: "Full name, mobile number, email address, and account sign-in, managed through secure OAuth session tokens." },
                { label: "Delivery and invoicing", value: "Shipping address, billing address, PIN code, and state of residence." },
                { label: "Payment", value: "Transaction identifiers, the payment method you chose, and payment status." },
              ],
            },
          ],
        },
        {
          id: "payments",
          heading: "Payment card security",
          blocks: [
            {
              kind: "note",
              tone: "important",
              title: "We never see your card details",
              body: "EYRA does not collect, view, or store your card numbers, CVVs, or UPI PINs. All transactions are tokenised and processed directly by our PCI-DSS Level 1 compliant payment partner, Razorpay.",
            },
          ],
        },
        {
          id: "use",
          heading: "How we use your information",
          blocks: [
            {
              kind: "cards",
              items: [
                { title: "Processing your order", body: "Checkout verification, stock allocation, GST tax invoices, payment processing through Razorpay, and dispatch with express couriers." },
                { title: "Order updates", body: "Order confirmations, dispatch updates, tracking links, and receipts sent by WhatsApp, SMS, and email." },
                { title: "Fraud prevention and security", body: "Screening checkout attempts and requests for bot activity, payment fraud, and unauthorised account access, using rate limiting and threat detection." },
                { title: "Improving the store", body: "Analysing browsing paths, traffic sources, and where shoppers leave checkout." },
                { title: "Marketing", body: "News of new drops, seasonal collections, and promotions. You can opt out at any time." },
              ],
            },
          ],
        },
        {
          id: "sharing",
          heading: "Who we share it with",
          blocks: [
            "We share personal data only with trusted infrastructure and operational providers, under confidential processing terms:",
            {
              kind: "details",
              items: [
                { label: "Razorpay", value: "Payment processing: order amount, contact information, and tokenised transaction data." },
                { label: "Shiprocket and its couriers", value: "Delivery: name, delivery address, PIN code, and phone number for transit and live tracking." },
                { label: "Clerk", value: "Sign-in: email and profile details used to sign you in securely." },
                { label: "Resend, AiSensy and WATI", value: "Messaging: phone number and email address, used to send order alerts, receipts, pickup and payment-link messages, and store credit notices." },
                { label: "Sentry and PostHog", value: "Reliability and analytics: anonymised device data, error logs, and usage data used to fix bugs." },
                { label: "Government authorities", value: "Strictly where required to comply with applicable law, court orders, or statutory tax audits." },
              ],
            },
          ],
        },
        {
          id: "advertising",
          heading: "Targeted advertising",
          blocks: [
            "We may use marketing pixels, such as Meta Pixel and Google Ads tags, to show our collections on other platforms.",
            "You can opt out of personalised ads through Meta Ad Preferences, Google Ads Settings, or the Digital Advertising Alliance consumer choice page.",
          ],
        },
        {
          id: "retention",
          heading: "Data retention and your rights",
          blocks: [
            "We keep order and invoicing records for as long as Indian accounting and tax law requires, including GST audit requirements for tax invoices and credit notes, or until you ask us to delete your account.",
            <>
              You have the right to review, correct, or ask us to delete the personal data we hold about you. To make a
              request, write to <TextLink href={`mailto:${contact.adminEmail}`} /> from the email address on your
              account. We respond within {policy.grievanceResolutionDays} days.
            </>,
          ],
        },
        {
          id: "do-not-track",
          heading: "Do Not Track",
          blocks: [
            "There is no common industry standard for browser Do Not Track signals, so our data practices stay the same whether or not your browser sends one.",
          ],
        },
        {
          id: "updates",
          heading: "Changes to this policy",
          blocks: [
            "We may update this policy to reflect changes in our systems, security practices, or legal obligations. Any change is posted on this page with a new revision date.",
          ],
        },
        {
          id: "grievance-officer",
          heading: "Grievance officer",
          blocks: [
            "As required by the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020, our designated officer is:",
            {
              kind: "details",
              items: [
                { label: "Company", value: seller.legalName },
                { label: "Officer", value: `${company.grievanceOfficer}, ${company.grievanceOfficerTitle}` },
                { label: "Registered office", value: `${seller.addressLine1}, ${seller.city}, ${seller.state}, India ${seller.pincode}` },
                { label: "Email", value: <TextLink href={`mailto:${contact.grievanceEmail}`} /> },
                {
                  label: "Response time",
                  value: `Acknowledged within ${policy.grievanceAckHours} hours and resolved within ${policy.grievanceResolutionDays} days of receipt.`,
                },
              ],
            },
          ],
        },
      ]}
    />
  );
}

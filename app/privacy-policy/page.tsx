import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";
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
      standfirst={`This policy describes how ${seller.legalName} collects, uses, processes, and protects your personal information when you visit, create an account on, or buy from eyra.org.in.`}
      updated="August 2026"
      sections={[
        {
          heading: "Our commitment",
          body: [
            "We are committed to maintaining the confidentiality and integrity of your data under applicable data protection law, including the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data Protection Act.",
          ],
        },
        {
          heading: "1A. Device and usage information, collected automatically",
          body: [
            "When you browse the storefront, our servers log technical metadata.",
          ],
          bullets: [
            "Device identifiers: IP address, operating system, browser type, device category, screen resolution, and time zone.",
            "Browsing activity: pages visited, collections and products viewed, referring and exit URLs, search keywords, and interaction timestamps.",
            "Cookies: small files placed on your browser for session management, cart persistence, and authentication state.",
            "Log files and web beacons: electronic files recording site events, server response latencies, and traffic flow.",
            "Analytics and session telemetry: anonymised data used to detect broken interface elements and improve checkout performance.",
          ],
        },
        {
          heading: "1B. Customer and order information, provided by you",
          body: [
            "When you create an account, check out, or contact customer care, we collect the following.",
          ],
          bullets: [
            "Identity and contact details: full name, mobile number, email address, and account credentials managed through secure OAuth session tokens.",
            "Delivery and invoicing data: shipping address, billing address, PIN code, and state of residence.",
            "Payment information: transaction identifiers, the payment mode you chose, and payment status.",
          ],
        },
        {
          heading: "Payment card security",
          body: [
            "EYRA does not collect, view, or store your raw credit or debit card numbers, CVVs, or UPI PINs. All transactions are tokenised and processed directly by our PCI-DSS Level 1 compliant payment gateway partner, Razorpay.",
          ],
        },
        {
          heading: "2. How we use your information",
          body: [
            "We process your data for operational, transactional, and marketing purposes.",
          ],
          bullets: [
            "Order processing and fulfilment: checkout verification, stock allocation, GST tax invoices, payment processing through Razorpay, and parcel dispatch with express couriers.",
            "Transactional communication: order confirmations, dispatch updates, tracking links, and invoice receipts sent by WhatsApp, SMS, and email.",
            "Fraud prevention and security: screening checkout attempts and API requests for bot activity, payment fraud, and unauthorised account access, using rate limiting and threat detection.",
            "Store optimisation: analysing browsing paths, traffic sources, and checkout drop-off to improve the store.",
            "Marketing: personalised drops, seasonal collections, and promotions, with an opt-out available at any time.",
          ],
        },
        {
          heading: "3. Sharing your information with third parties",
          body: [
            "We do not sell, rent, or trade your personal data. We disclose it only to trusted infrastructure and operational providers, under confidential processing terms.",
          ],
          bullets: [
            "Razorpay, for payment processing: order amount, contact information, and tokenised transaction data.",
            "Shiprocket and its courier partners, for logistics: name, delivery address, PIN code, and phone number for transit and live tracking.",
            "Clerk, for authentication: email and profile credentials used to sign you in securely.",
            "Resend, AiSensy and WATI, for messaging: phone number and email address used to send transactional order alerts, receipts, pickup and payment-link messages, and store credit notices.",
            "Sentry and PostHog, for analytics and reliability: anonymised device telemetry, error logs, and usage data used to fix bugs.",
            "Government authorities, strictly where required to comply with applicable law, court orders, or statutory tax audits.",
          ],
        },
        {
          heading: "4. Targeted advertising",
          body: [
            "We may use marketing pixels, such as Meta Pixel and Google Ads tags, to show our collections on external platforms.",
            "You can opt out of personalised ad targeting through Meta Ad Preferences, Google Ads Settings, or the Digital Advertising Alliance consumer choice page.",
          ],
        },
        {
          heading: "5. Data retention and your rights",
          body: [
            "We retain order and invoicing records for as long as Indian accounting and taxation law requires, including GST audit requirements for tax invoices and credit notes, or until you ask us to delete your account.",
            `You have the right to review, correct, or request deletion of the personal data we hold. To make a request, write to ${contact.adminEmail} from the address on your account. We respond within ${policy.grievanceResolutionDays} days.`,
          ],
        },
        {
          heading: "6. Do Not Track",
          body: [
            "Industry standards for recognising browser Do Not Track signals are not uniform, so our data collection practices remain consistent regardless of incoming DNT headers.",
          ],
        },
        {
          heading: "7. Policy updates",
          body: [
            "We may revise this policy to reflect changes in our systems, security practices, or legal obligations. Any change is posted on this page with an updated revision date.",
          ],
        },
        {
          heading: "8. Grievance officer and statutory contact",
          body: [
            "In accordance with the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020, the designated officer is set out below.",
          ],
          bullets: [
            `Company: ${seller.legalName}`,
            `Officer: ${company.grievanceOfficer}, ${company.grievanceOfficerTitle}`,
            `Registered office: ${seller.addressLine1}, ${seller.city}, ${seller.state}, India ${seller.pincode}`,
            `Email: ${contact.grievanceEmail}`,
            `Response: grievances acknowledged within ${policy.grievanceAckHours} hours and resolved within ${policy.grievanceResolutionDays} days of receipt.`,
          ],
        },
      ]}
    />
  );
}

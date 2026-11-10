import type { Metadata } from "next";
import { LegalDocument, TextLink } from "@/components/layout/LegalDocument";
import { storeConfig } from "@/config/storeConfig";

export const metadata: Metadata = {
  title: "Grievance Redressal",
  description:
    "EYRA's designated Grievance and Nodal Officer, contact details, and resolution timelines under the Consumer Protection (E-Commerce) Rules, 2020.",
};

const { contact, company, policy, seller } = storeConfig;

const mail = (address: string) => <TextLink href={`mailto:${address}`} />;

export default function GrievanceRedressalPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Grievance Redressal"
      standfirst="Published under the Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology Act, 2000."
      updated="October 2026"
      highlights={[
        { label: "Acknowledged", value: `${policy.grievanceAckHours} hours`, note: "from when we receive your grievance" },
        { label: "Resolved", value: `${policy.grievanceResolutionDays} days`, note: "from when we receive your grievance" },
      ]}
      sections={[
        {
          id: "before-escalating",
          heading: "Before escalating",
          blocks: [
            "Most issues are resolved fastest through our regular support channels. The grievance channel is for complaints they have not resolved.",
            {
              kind: "details",
              items: [
                { label: "About an order", value: mail(contact.ordersEmail) },
                { label: "Anything else", value: mail(contact.supportEmail) },
                { label: "Support hours", value: contact.hours },
              ],
            },
          ],
        },
        {
          id: "officer",
          heading: "Grievance and Nodal Officer",
          blocks: [
            "If a complaint has not been resolved through our support channels, you can escalate it directly to our designated officer.",
            {
              kind: "details",
              items: [
                { label: "Name", value: company.grievanceOfficer },
                { label: "Designation", value: company.grievanceOfficerTitle },
                { label: "Company", value: seller.legalName },
                { label: "CIN", value: company.cin },
                { label: "Address", value: `${seller.addressLine1}, ${seller.city}, ${seller.state}, India ${seller.pincode}` },
                { label: "Email", value: mail(contact.grievanceEmail) },
              ],
            },
          ],
        },
        {
          id: "what-to-include",
          heading: "What to include",
          blocks: [
            "To help us act on your complaint in the first reply, please include:",
            {
              kind: "steps",
              items: [
                { title: "Your order details", body: "The order number, and the email address or mobile number registered on your account." },
                { title: "The issue", body: "A clear description of the problem and the resolution you are looking for." },
                { title: "Supporting evidence", body: "Photographs, or the unboxing video if the complaint is about transit damage or a missing item." },
                { title: "Earlier messages", body: "Details of any earlier correspondence with our support team, including dates." },
              ],
            },
          ],
        },
        {
          id: "timelines",
          heading: "Resolution timelines",
          blocks: [
            `We acknowledge every grievance within ${policy.grievanceAckHours} hours of receiving it, and resolve it within ${policy.grievanceResolutionDays} days.`,
            {
              kind: "note",
              body: "If a complaint needs longer because it depends on a courier investigation or a bank settlement cycle, we will tell you why and give you a revised date, rather than let it lapse.",
            },
          ],
        },
      ]}
    />
  );
}

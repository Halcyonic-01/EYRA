import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";
import { storeConfig } from "@/config/storeConfig";

export const metadata: Metadata = {
  title: "Grievance Redressal",
  description:
    "EYRA's designated Grievance and Nodal Officer, contact details, and resolution timelines under the Consumer Protection (E-Commerce) Rules, 2020.",
};

const { contact, company, policy, seller } = storeConfig;

export default function GrievanceRedressalPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Grievance Redressal"
      standfirst="Published under the Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology Act, 2000."
      updated="October 2026"
      sections={[
        {
          heading: "Designated Grievance and Nodal Officer",
          body: [
            "If a complaint has not been resolved through our normal support channel, you can escalate it directly to our designated officer.",
          ],
          bullets: [
            `Name: ${company.grievanceOfficer}`,
            `Designation: ${company.grievanceOfficerTitle}`,
            `Company: ${seller.legalName}`,
            `CIN: ${company.cin}`,
            `Address: ${seller.addressLine1}, ${seller.city}, ${seller.state}, India ${seller.pincode}`,
            `Email: ${contact.adminEmail}`,
          ],
        },
        {
          heading: "Resolution timelines",
          body: [
            `We acknowledge every grievance within ${policy.grievanceAckHours} hours of receipt, and resolve it within ${policy.grievanceResolutionDays} days.`,
            "If a complaint needs longer because it depends on a courier investigation or a bank settlement cycle, we will tell you why and give you a revised date rather than let it lapse silently.",
          ],
        },
        {
          heading: "What to include",
          body: [
            "So we can act on the first reply rather than the third, please include the following.",
          ],
          bullets: [
            "Your order number and the registered email or mobile number on the account.",
            "A clear description of the issue and the resolution you are seeking.",
            "Any supporting evidence, such as photographs or the unboxing video where the complaint concerns transit damage or a missing item.",
            "Details of any earlier correspondence with our support team, including dates.",
          ],
        },
        {
          heading: "Before escalating",
          body: [
            `Most issues are resolved fastest by writing to ${contact.ordersEmail} about an order, or to our support desk at ${contact.supportEmail} for anything else. The support desk is staffed ${contact.hours}. The grievance channel is for complaints that those channels have not resolved.`,
          ],
        },
      ]}
    />
  );
}

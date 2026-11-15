import type { Metadata } from "next";
import { LegalDocument, TextLink, type Highlight, type LegalSection } from "@/components/layout/LegalDocument";
import { storeConfig } from "@/config/storeConfig";

export const metadata: Metadata = {
  title: "Review Policy",
  description: "Who can review EYRA jewellery, how reviews are checked, when a review is not published, and how ratings are worked out.",
};

const { contact } = storeConfig;

const highlights: Highlight[] = [
  { label: "Who reviews", value: "Buyers only", note: "every review comes from a delivered order" },
  { label: "Negative reviews", value: "Published", note: "never removed for being critical" },
  { label: "Ratings", value: "Real reviews", note: "worked out only from published reviews" },
];

const sections: LegalSection[] = [
  {
    id: "who",
    heading: "Who can write a review",
    blocks: [
      "Only customers who bought a piece and received it can review it. After your order is delivered we email you, and message you on WhatsApp if you agreed to that at checkout, with a private link to review what you bought. You can also review from My orders once you are signed in.",
      "Each review shows a Verified purchase badge. We never write reviews ourselves, pay for reviews, or offer anything in return for a positive one.",
    ],
  },
  {
    id: "checking",
    heading: "How reviews are checked",
    blocks: [
      "Every review is read by our team before it is published, usually within a working day. We publish honest reviews whether they are positive or negative, and we do not edit what you write.",
      {
        kind: "list",
        items: [
          "Spam or advertising, including links to other shops",
          "Abusive, hateful or obscene language",
          "Personal or contact details, yours or anyone else's",
          "Content that is not about the product",
          "A review that is not genuine, for example written for someone else",
          "Photos that are inappropriate or not of the product",
        ],
      },
      "A review is only rejected for one of the reasons above, and we keep a record of the reason. A low rating on its own is never a reason.",
    ],
  },
  {
    id: "ratings",
    heading: "How ratings are worked out",
    blocks: [
      "A product's star rating is the average of its published reviews, and the number shown is how many published reviews it has. No rating is shown until a product has its first published review.",
    ],
  },
  {
    id: "changes",
    heading: "Changing or removing your review",
    blocks: [
      "You can change your review at any time from the order under My orders. A changed review is checked again before the new version is published. To have a review removed, email us.",
    ],
  },
];

export default function ReviewPolicyPage() {
  return (
    <LegalDocument
      eyebrow="Customer care"
      title="Review Policy"
      standfirst="Reviews help other shoppers choose. Here is who can write one, how we check them, and how ratings are worked out."
      updated="November 2026"
      highlights={highlights}
      sections={sections}
      help={{ title: "Questions about a review?", body: <>Email <TextLink href={`mailto:${contact.ordersEmail}`} /> and we will help.</> }}
    />
  );
}

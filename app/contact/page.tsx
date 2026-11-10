import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContactForm } from "@/components/contact/ContactForm";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { storeConfig } from "@/config/storeConfig";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the EYRA team about an order, a return, or anything else.",
};

const { contact, seller, policy } = storeConfig;

const QUICK_LINKS = [
  {
    label: "Track an order",
    description: "Live courier status sits against every order in your account.",
    href: "/orders",
  },
  {
    label: "Start a return",
    description: `Returns within ${policy.returnDays} days, exchanges within ${policy.exchangeDays} days.`,
    href: "/refund-policy",
  },
  {
    label: "Shipping and delivery",
    description: "Timelines, charges, and coverage across India.",
    href: "/shipping-policy",
  },
  {
    label: "Common questions",
    description: "Sizing, care, payments, and the answers we give most often.",
    href: "/support",
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="bg-white pb-16 lg:pb-24">
        <PageHeader
          eyebrow="Talk to us"
          title="Contact"
          standfirst="A real person reads every message. We reply within one working day, usually sooner."
        />

        <div className="max-w-screen-xl mx-auto px-6 lg:px-10 mt-12">
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-20">
            {/* Form */}
            <div>
              <h2 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-6">
                Send us a message
              </h2>
              <ContactForm />
            </div>

            {/* Details */}
            <aside className="flex flex-col gap-10">
              <div>
                <h2 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-4">
                  Email
                </h2>
                <a
                  href={`mailto:${contact.supportEmail}`}
                  className="font-sans font-light text-[16px] leading-[26px] text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200"
                >
                  {contact.supportEmail}
                </a>
                <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050] mt-2">
                  {contact.hours}
                </p>
                {contact.whatsapp && (
                  <p className="mt-3">
                    <a
                      href={`https://wa.me/${contact.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-sans font-light text-[16px] leading-[26px] text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200"
                    >
                      Chat with us on WhatsApp
                    </a>
                  </p>
                )}
              </div>

              <div>
                <h2 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-4">
                  Press and partnerships
                </h2>
                <a
                  href={`mailto:${contact.pressEmail}`}
                  className="font-sans font-light text-[16px] leading-[26px] text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200"
                >
                  {contact.pressEmail}
                </a>
              </div>

              <div>
                <h2 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-4">
                  Registered office
                </h2>
                <address className="not-italic font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                  {seller.legalName}
                  <br />
                  {seller.addressLine1}
                  {seller.addressLine2 && (
                    <>
                      <br />
                      {seller.addressLine2}
                    </>
                  )}
                  <br />
                  {seller.city}, {seller.state} {seller.pincode}
                  <br />
                  India
                </address>
                <p className="font-sans font-light text-[14px] leading-[24px] text-[#909090] mt-3">
                  This is our registered address, not a returns address. Please
                  raise a return before sending anything back.
                </p>
              </div>

              <div>
                <h2 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-4">
                  Formal grievances
                </h2>
                <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                  If support has not resolved your issue, escalate to our
                  designated officer at{" "}
                  <a
                    href={`mailto:${contact.adminEmail}`}
                    className="text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200"
                  >
                    {contact.adminEmail}
                  </a>
                  . See the{" "}
                  <Link
                    href="/grievance-redressal"
                    className="text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200"
                  >
                    grievance redressal
                  </Link>{" "}
                  page for timelines.
                </p>
              </div>

              <div>
                <h2 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-4">
                  Before you write
                </h2>
                <ul className="flex flex-col gap-4">
                  {QUICK_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="font-sans font-normal text-[16px] leading-[26px] text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
                      <p className="font-sans font-light text-[14px] leading-[24px] text-[#909090]">
                        {link.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <NewsletterBanner />
    </>
  );
}

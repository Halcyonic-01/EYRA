import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
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

const LINK = "text-black underline underline-offset-4 decoration-[#B0B0B0] hover:decoration-black transition-colors duration-200";

const QUICK_LINKS = [
  {
    label: "Track an order",
    description: "Live courier status sits against every order in your account.",
    href: "/orders",
  },
  {
    label: "Start a return",
    description: `Returns within ${policy.returnDays} days, exchanges within ${policy.exchangeDays} days.`,
    href: "/refund-policy#how-to",
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

function Channel({
  id,
  label,
  email,
  children,
}: {
  id?: string;
  label: string;
  email: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className="bg-white border border-[#E2E2E2] p-6 flex flex-col gap-3" style={{ scrollMarginTop: "calc(var(--header-offset) + 1rem)" }}>
      <p className="font-sans font-normal text-[0.68rem] tracking-[0.24em] uppercase text-[#909090]">{label}</p>
      <a href={`mailto:${email}`} className={`font-sans font-normal text-[15px] leading-[24px] break-all ${LINK}`}>
        {email}
      </a>
      <div className="font-sans font-light text-[14px] leading-[23px] text-[#505050]">{children}</div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <>
      <section className="bg-white pb-14">
        <PageHeader
          eyebrow="Talk to us"
          title="Contact"
          standfirst="A real person reads every message. We reply within one working day, usually sooner."
          align="center"
        />
      </section>

      {/* Ways to reach us */}
      <section className="bg-ivory py-14 lg:py-16 border-y border-[#EEEEEE]">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Channel label="Orders and returns" email={contact.ordersEmail}>
              Cancelling, shipping, returns, and refunds. Please include your order number.
            </Channel>
            <Channel label="General questions" email={contact.supportEmail}>
              {contact.hours}.
              {contact.whatsapp && (
                <>
                  {" "}
                  <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className={LINK}>
                    Chat with us on WhatsApp
                  </a>
                </>
              )}
            </Channel>
            <Channel id="press" label="Press and partnerships" email={contact.pressEmail}>
              Media requests, collaborations, and partnership enquiries.
            </Channel>
            <Channel label="Formal grievances" email={contact.grievanceEmail}>
              If support has not resolved your issue, escalate to our designated officer. See{" "}
              <Link href="/grievance-redressal" className={LINK}>
                grievance redressal
              </Link>{" "}
              for timelines.
            </Channel>
          </div>
        </div>
      </section>

      {/* Form and help */}
      <section className="bg-white py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-12 lg:gap-20">
            <div className="min-w-0">
              <h2 className="font-display font-light italic text-[clamp(1.85rem,3.5vw,2.5rem)] leading-[1.15] text-black mb-2">
                Send us a message
              </h2>
              <p className="font-sans font-light text-[15px] leading-[25px] text-[#505050] mb-8">
                Choose a topic, tell us how we can help, and we will reply by email.
              </p>
              <ContactForm />
            </div>

            <aside className="min-w-0 flex flex-col gap-10">
              <div>
                <h2 className="font-sans font-medium text-[17px] leading-[26px] text-black mb-2">Before you write</h2>
                <p className="font-sans font-light text-[14px] leading-[23px] text-[#626262] mb-4">
                  The answer may already be here.
                </p>
                <ul className="border-t border-[#E2E2E2]">
                  {QUICK_LINKS.map((link) => (
                    <li key={link.href} className="border-b border-[#E2E2E2]">
                      <Link href={link.href} className="group flex items-center justify-between gap-4 py-4">
                        <span className="min-w-0">
                          <span className="block font-sans font-normal text-[15px] leading-[24px] text-black">
                            {link.label}
                          </span>
                          <span className="block font-sans font-light text-[13px] leading-[21px] text-[#909090]">
                            {link.description}
                          </span>
                        </span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="shrink-0 text-[#909090] group-hover:text-black group-hover:translate-x-0.5 transition-all duration-200">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-ivory border border-[#E2E2E2] p-6">
                <h2 className="font-sans font-medium text-[17px] leading-[26px] text-black mb-3">Registered office</h2>
                <address className="not-italic font-sans font-light text-[15px] leading-[25px] text-[#505050]">
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
                <p className="font-sans font-light text-[13px] leading-[21px] text-[#909090] mt-3">
                  This is our registered address, not a returns address. Please raise a return before sending anything
                  back.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <NewsletterBanner />
    </>
  );
}

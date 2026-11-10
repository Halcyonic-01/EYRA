import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { FadeIn } from "@/components/ui/FadeIn";
import { storeConfig } from "@/config/storeConfig";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Work with EYRA. Open roles, how we hire, and how to reach us if nothing fits.",
};

const { contact, seller } = storeConfig;

/**
 * Open roles. Empty for now, and the page renders an honest open-application
 * state rather than inventing listings. Add entries here to publish a role.
 */
const OPEN_ROLES: {
  title: string;
  team: string;
  location: string;
  type: string;
}[] = [];

const HOW_WE_WORK = [
  {
    title: "Small team, wide scope",
    body: "Everyone here touches more than their job title. If you want a narrow lane and a long approval chain, this will frustrate you.",
  },
  {
    title: "Craft over speed",
    body: "We would rather ship one thing properly than four things approximately. That applies to the jewellery and to the software.",
  },
  {
    title: "Say the hard thing",
    body: "Disagreement early is cheaper than politeness followed by rework. We expect people to flag problems while they are still small.",
  },
];

export default function CareersPage() {
  return (
    <>
      <section className="bg-white pb-16 lg:pb-24">
        <PageHeader
          eyebrow="Join us"
          title="Careers"
          standfirst="We are a small team building a silver brand that treats its customers like adults. If that sounds like your kind of work, talk to us."
        />

        {/* Open roles */}
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10 mt-12">
          <FadeIn>
            <h2 className="font-display font-light italic text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.15] text-black mb-8">
              Open roles
            </h2>
          </FadeIn>

          {OPEN_ROLES.length === 0 ? (
            <FadeIn>
              <div className="border border-[#CFCFCF] bg-ivory px-6 py-10 sm:px-10 max-w-[760px]">
                <h3 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-3">
                  No roles open right now
                </h3>
                <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050] mb-6">
                  We would rather leave this page empty than list roles we are
                  not actually hiring for. When something opens, it appears here
                  first.
                </p>
                <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                  If you think you should be working here anyway, send us a note
                  with what you would want to own. We read every one.
                </p>
                <a
                  href={`mailto:${contact.careersEmail}?subject=Open application`}
                  className="inline-block mt-7 px-9 py-3.5 rounded-full bg-black text-white font-sans font-normal text-[0.72rem] tracking-[0.2em] uppercase hover:bg-[#3d3d3d] transition-colors duration-200"
                >
                  Send an open application
                </a>
              </div>
            </FadeIn>
          ) : (
            <div className="flex flex-col border-t border-[#CFCFCF] max-w-[900px]">
              {OPEN_ROLES.map((role) => (
                <div
                  key={role.title}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#CFCFCF] py-6"
                >
                  <div>
                    <h3 className="font-sans font-medium text-[18px] leading-[27px] text-black">
                      {role.title}
                    </h3>
                    <p className="font-sans font-light text-[14px] leading-[24px] text-[#909090]">
                      {role.team} · {role.location} · {role.type}
                    </p>
                  </div>
                  <a
                    href={`mailto:${contact.careersEmail}?subject=${encodeURIComponent(role.title)}`}
                    className="font-sans font-normal text-[16px] text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200 shrink-0"
                  >
                    Apply
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How we work */}
      <section className="bg-ivory py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <FadeIn>
            <h2 className="font-display font-light italic text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.15] text-black mb-12 max-w-[520px]">
              How we work
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14">
            {HOW_WE_WORK.map((item, i) => (
              <FadeIn key={item.title} delay={i * 80}>
                <div className="border-t border-[#CFCFCF] pt-5">
                  <h3 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-3">
                    {item.title}
                  </h3>
                  <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                    {item.body}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={240}>
            <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050] mt-12 max-w-[640px]">
              We hire without regard to caste, religion, gender, age, or
              disability, and we are based in {seller.city}, {seller.state}. Read
              more about{" "}
              <Link
                href="/about"
                className="text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200"
              >
                what we are building
              </Link>
              .
            </p>
          </FadeIn>
        </div>
      </section>

      <NewsletterBanner />
    </>
  );
}

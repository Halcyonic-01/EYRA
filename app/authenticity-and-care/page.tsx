import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { ANCHOR_OFFSET, JumpLinks, SectionIntro } from "@/components/layout/SectionIntro";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { FadeIn } from "@/components/ui/FadeIn";
import { SIZE_CHART } from "@/lib/sizing";
import { storeConfig } from "@/config/storeConfig";

export const metadata: Metadata = {
  title: "Authenticity, Care and Sizing",
  description:
    "925 sterling silver purity and BIS hallmarking explained, anti-tarnish coating, care instructions, and the EYRA ring sizing chart.",
};

const { contact, policy, company } = storeConfig;

const TEXT = "font-sans font-light text-[15px] leading-[25px] text-[#505050]";
const LINK = "text-black underline underline-offset-4 decoration-[#B0B0B0] hover:decoration-black transition-colors duration-200";

const CARE = [
  {
    title: "When you wear it",
    tips: [
      "Avoid direct contact with perfumes, hand sanitisers, lotions, and chlorinated water.",
      "Put jewellery on last, after perfume and lotion have fully dried.",
      "Take pieces off before swimming, showering, or the gym.",
    ],
  },
  {
    title: "When you store it",
    tips: ["Store each piece in its own airtight zip pouch to slow oxidation."],
  },
  {
    title: "When you clean it",
    tips: [
      "Clean gently with a dedicated microfibre silver polishing cloth.",
      "For heavier tarnish, use warm water with a drop of mild soap and a soft brush, then dry completely.",
    ],
  },
];

const MEASURE = [
  "Take a ring that already fits the finger you want to wear it on.",
  "Measure the inner circumference of the band in millimetres.",
  "Find the closest match in the chart. If you fall between two sizes, take the larger one.",
];

export default function AuthenticityAndCarePage() {
  return (
    <>
      <section className="bg-white pb-14 lg:pb-16">
        <PageHeader
          eyebrow="Authenticity and care"
          title="925 Silver, hallmarking, and how to look after it"
          standfirst="What our purity mark means, how we protect the finish, and the sizing chart to help you get the right fit the first time."
          align="center"
        />
        <JumpLinks
          links={[
            { href: "#purity", label: "Purity and hallmarking" },
            { href: "#care", label: "Care instructions" },
            { href: "#sizing", label: "Ring sizing chart" },
          ]}
        />
      </section>

      {/* Purity */}
      <section id="purity" style={ANCHOR_OFFSET} className="bg-ivory py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <FadeIn>
            <SectionIntro eyebrow="Authenticity" title="What makes it real silver" className="mb-12">
              Every mark on an EYRA piece is there for a reason. Here is what each one tells you.
            </SectionIntro>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <FadeIn>
              <div className="h-full bg-white border border-[#E2E2E2] p-7 flex flex-col gap-3">
                <p className="font-display font-light italic text-[2.5rem] leading-none text-black">92.5%</p>
                <h3 className="font-sans font-medium text-[17px] leading-[26px] text-black">Purity standard</h3>
                <p className={TEXT}>
                  Every EYRA piece is crafted from certified 925 sterling silver: 92.5 percent pure silver, alloyed
                  with copper for strength. Fine silver on its own is too soft to hold a shape you can wear every
                  day, which is why the alloy exists.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={80}>
              <div className="h-full bg-white border border-[#E2E2E2] p-7 flex flex-col gap-3">
                <p className="font-display font-light italic text-[2.5rem] leading-none text-black">BIS</p>
                <h3 className="font-sans font-medium text-[17px] leading-[26px] text-black">BIS hallmarking</h3>
                <p className={TEXT}>
                  Our jewellery is BIS hallmarked: its silver purity has been independently verified by the Bureau of
                  Indian Standards, not simply stated by us. The mark on your piece is your proof, not our claim.
                </p>
                <p className="mt-auto pt-4 border-t border-[#EEEEEE] font-sans font-light text-[14px] leading-[22px] text-[#505050]">
                  Our BIS Hallmarking registration number is{" "}
                  <span className="font-medium text-black">{company.bisRegistration}</span>.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={160}>
              <div className="h-full bg-white border border-[#E2E2E2] p-7 flex flex-col gap-3">
                <p className="font-display font-light italic text-[2.5rem] leading-none text-black">Coated</p>
                <h3 className="font-sans font-medium text-[17px] leading-[26px] text-black">Anti-tarnish coating</h3>
                <p className={TEXT}>
                  Pieces carry a protective rhodium or e-coating layer that slows oxidation and keeps the finish
                  bright for longer. Sterling silver still tarnishes eventually. That is chemistry, not a defect, and
                  it reverses with a minute of care.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Care */}
      <section id="care" style={ANCHOR_OFFSET} className="bg-white py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <FadeIn>
            <SectionIntro eyebrow="Care" title="Care instructions" className="mb-12">
              A few simple habits keep sterling silver bright for years.
            </SectionIntro>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-10">
            {CARE.map((group, i) => (
              <FadeIn key={group.title} delay={i * 80}>
                <div className="border-t border-black pt-5">
                  <p className="font-sans font-normal text-[0.68rem] tracking-[0.24em] uppercase text-[#909090] mb-2">
                    0{i + 1}
                  </p>
                  <h3 className="font-sans font-medium text-[17px] leading-[26px] text-black mb-4">{group.title}</h3>
                  <ul className="flex flex-col gap-3">
                    {group.tips.map((tip) => (
                      <li key={tip} className={`${TEXT} relative pl-6`}>
                        <span aria-hidden="true" className="absolute left-0 top-[12px] w-2 h-px bg-[#909090]" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={200}>
            <div className="mt-14 max-w-[760px] mx-auto bg-ivory border-l-2 border-black px-6 py-5 text-center sm:text-left">
              <p className="font-sans font-medium text-[15px] leading-[24px] text-black">
                {policy.warrantyMonths}-month warranty on manufacturing defects
              </p>
              <p className={`${TEXT} mt-1`}>
                Manufacturing defects are covered for {policy.warrantyMonths} months from delivery. See the{" "}
                <Link href="/terms-of-service#warranty" className={LINK}>
                  warranty terms
                </Link>{" "}
                and our{" "}
                <Link href="/refund-policy" className={LINK}>
                  returns policy
                </Link>
                .
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Sizing */}
      <section id="sizing" style={ANCHOR_OFFSET} className="bg-ivory py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <FadeIn>
            <SectionIntro eyebrow="Sizing" title="Ring sizing chart" className="mb-12">
              Indian ring sizes with their inner measurements. Sizing exchanges carry no fee within{" "}
              {policy.exchangeDays} days of delivery.
            </SectionIntro>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 lg:gap-16 items-start">
            <FadeIn>
              <div className="flex flex-col gap-8">
                <div>
                  <h3 className="font-sans font-medium text-[17px] leading-[26px] text-black mb-5">
                    How to find your size
                  </h3>
                  <ol className="flex flex-col gap-5">
                    {MEASURE.map((step, i) => (
                      <li key={step} className="flex gap-4">
                        <span className="shrink-0 w-8 h-8 rounded-full border border-[#CFCFCF] bg-white flex items-center justify-center font-sans text-[13px] text-black">
                          {i + 1}
                        </span>
                        <p className={`${TEXT} pt-[3px]`}>{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="bg-white border border-[#E2E2E2] p-6">
                  <p className="font-sans font-medium text-[15px] leading-[24px] text-black mb-1">Not sure of your size?</p>
                  <p className={TEXT}>
                    Email{" "}
                    <a href={`mailto:${contact.supportEmail}`} className={LINK}>
                      {contact.supportEmail}
                    </a>{" "}
                    and we will talk you through measuring at home before you order.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={80}>
              <div className="overflow-x-auto border border-[#E2E2E2] bg-white">
                <table className="w-full border-collapse min-w-[360px] tabular-nums">
                  <caption className="sr-only">
                    Indian ring sizes with inner circumference and diameter in millimetres
                  </caption>
                  <thead>
                    <tr className="bg-charcoal">
                      {["Indian size", "Circumference (mm)", "Diameter (mm)"].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="text-center font-sans font-normal text-[13px] tracking-[0.04em] text-white px-4 py-3.5"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SIZE_CHART.map((row) => (
                      <tr key={row.size} className="even:bg-[#FAFAFA] hover:bg-[#F2F2F2] transition-colors duration-150">
                        <td className="text-center font-sans font-medium text-[14px] text-black px-4 py-3 border-b border-[#EEEEEE]">
                          {row.size}
                        </td>
                        <td className="text-center font-sans font-light text-[14px] text-[#505050] px-4 py-3 border-b border-[#EEEEEE]">
                          {row.circumference.toFixed(1)}
                        </td>
                        <td className="text-center font-sans font-light text-[14px] text-[#505050] px-4 py-3 border-b border-[#EEEEEE]">
                          {row.diameter.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <NewsletterBanner />
    </>
  );
}

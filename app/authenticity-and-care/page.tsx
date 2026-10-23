import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { FadeIn } from "@/components/ui/FadeIn";
import { SIZE_CHART } from "@/lib/sizing";
import { storeConfig } from "@/config/storeConfig";

export const metadata: Metadata = {
  title: "Authenticity, Care and Sizing",
  description:
    "925 sterling silver purity and BIS hallmarking explained, anti-tarnish coating, care instructions, and the EYRA ring sizing chart.",
};

const { contact, policy } = storeConfig;

const CARE = [
  "Avoid direct contact with perfumes, hand sanitisers, lotions, and chlorinated water.",
  "Put jewellery on last, after perfume and lotion have fully dried.",
  "Take pieces off before swimming, showering, or the gym.",
  "Store each piece in its own airtight zip pouch to slow oxidation.",
  "Clean gently with a dedicated microfibre silver polishing cloth.",
  "For heavier tarnish, use warm water with a drop of mild soap and a soft brush, then dry completely.",
];

export default function AuthenticityAndCarePage() {
  return (
    <>
      <section className="bg-white pb-16">
        <PageHeader
          eyebrow="Authenticity and care"
          title="925 Silver, hallmarking, and how to look after it"
          standfirst="What our purity mark actually means, how we protect the finish, and the sizing chart to get your fit right the first time."
          crumbs={[{ label: "Authenticity and Care" }]}
        />
      </section>

      {/* Purity */}
      <section className="bg-ivory py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <div className="max-w-[760px] flex flex-col gap-10">
            <FadeIn>
              <div>
                <h2 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-4">
                  Purity standard
                </h2>
                <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                  Every EYRA piece is crafted from certified 925 sterling silver:
                  92.5 percent pure silver, alloyed with copper for strength.
                  Fine silver on its own is too soft to hold a shape you can wear
                  daily, which is why the alloy exists.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={80}>
              <div>
                <h2 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-4">
                  BIS hallmarking
                </h2>
                <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                  Our jewellery is BIS hallmarked, which means the silver purity
                  has been independently verified by the Bureau of Indian
                  Standards rather than simply asserted by us. The mark on your
                  piece is your proof, not our claim.
                </p>
                <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050] mt-3">
                  Our BIS Hallmarking registration number is{" "}
                  <span className="font-medium text-black">{storeConfig.company.bisRegistration}</span>.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={160}>
              <div>
                <h2 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-4">
                  Anti-tarnish coating
                </h2>
                <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                  Pieces carry a protective rhodium or e-coating layer that slows
                  oxidation and keeps the finish bright for longer. Sterling
                  silver still tarnishes eventually. That is chemistry, not a
                  defect, and it reverses with a minute of care.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Care */}
      <section className="bg-white py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <div className="max-w-[760px]">
            <FadeIn>
              <h2 className="font-display font-light italic text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.15] text-black mb-6">
                Care instructions
              </h2>
            </FadeIn>
            <FadeIn delay={80}>
              <ul className="flex flex-col gap-3 list-disc pl-5">
                {CARE.map((tip) => (
                  <li
                    key={tip}
                    className="font-sans font-light text-[16px] leading-[26px] text-[#505050]"
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            </FadeIn>
            <FadeIn delay={160}>
              <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050] mt-6">
                Manufacturing defects are covered for {policy.warrantyMonths}{" "}
                months from delivery. See the{" "}
                <Link
                  href="/refund-policy"
                  className="text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200"
                >
                  returns and warranty terms
                </Link>
                .
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Sizing */}
      <section className="bg-ivory py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <div className="max-w-[760px]">
            <FadeIn>
              <h2 className="font-display font-light italic text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.15] text-black mb-4">
                Ring sizing chart
              </h2>
              <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050] mb-8">
                Measure the inner circumference of a ring that already fits you,
                then match it below. If you fall between two sizes, take the
                larger one. Sizing exchanges carry no fee within{" "}
                {policy.exchangeDays} days of delivery.
              </p>
            </FadeIn>

            <FadeIn delay={80}>
              <div className="overflow-x-auto border border-[#CFCFCF] bg-white">
                <table className="w-full border-collapse min-w-[420px]">
                  <caption className="sr-only">
                    Indian ring sizes with inner circumference and diameter in millimetres
                  </caption>
                  <thead>
                    <tr className="bg-[#F7F7F7]">
                      <th scope="col" className="text-left font-sans font-medium text-[14px] text-black px-5 py-3 border-b border-[#CFCFCF]">
                        Indian size
                      </th>
                      <th scope="col" className="text-left font-sans font-medium text-[14px] text-black px-5 py-3 border-b border-[#CFCFCF]">
                        Circumference (mm)
                      </th>
                      <th scope="col" className="text-left font-sans font-medium text-[14px] text-black px-5 py-3 border-b border-[#CFCFCF]">
                        Diameter (mm)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {SIZE_CHART.map((row) => (
                      <tr key={row.size} className="even:bg-[#FBFBFB]">
                        <td className="font-sans font-normal text-[14px] text-black px-5 py-3 border-b border-[#EEEEEE]">
                          {row.size}
                        </td>
                        <td className="font-sans font-light text-[14px] text-[#505050] px-5 py-3 border-b border-[#EEEEEE]">
                          {row.circumference}
                        </td>
                        <td className="font-sans font-light text-[14px] text-[#505050] px-5 py-3 border-b border-[#EEEEEE]">
                          {row.diameter}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FadeIn>

            <FadeIn delay={160}>
              <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050] mt-6">
                Not sure which size you are? Email{" "}
                <a
                  href={`mailto:${contact.supportEmail}`}
                  className="text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200"
                >
                  {contact.supportEmail}
                </a>{" "}
                and we will talk you through measuring at home before you order.
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      <NewsletterBanner />
    </>
  );
}

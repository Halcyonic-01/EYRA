import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsBar } from "@/components/home/StatsBar";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { FadeIn } from "@/components/ui/FadeIn";

export const metadata: Metadata = {
  title: "About",
  description:
    "EYRA makes 925 sterling silver jewellery for people who wear their identity. Here is how we started and what we stand for.",
};

const PILLARS = [
  {
    title: "Solid 925 silver, always",
    body: "No plating over brass, no filler alloys. Every piece is struck from sterling silver and hallmarked, so what you buy holds its value and can be repaired rather than replaced.",
  },
  {
    title: "Made in small batches",
    body: "We produce in short runs rather than mass quantities. It keeps the finishing careful, the inventory honest, and lets us retire a design when it stops feeling right.",
  },
  {
    title: "Priced without theatre",
    body: "We sell directly, so you pay for the metal and the making rather than a retail markup. The compare-at price on a product page is the market rate, not an invented number.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="bg-white pb-16">
        <PageHeader
          eyebrow="Our story"
          title="Silver for people who wear their identity"
          standfirst="EYRA began with a simple frustration: good sterling silver was either priced like a luxury import or made so cheaply it turned your skin green within a month. We wanted the middle to exist."
          crumbs={[{ label: "About" }]}
        />

        {/* Opening image */}
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10 mt-12">
          <FadeIn>
            <div className="relative w-full aspect-[16/7] overflow-hidden bg-pewter">
              <Image
                src="/images/brand-1.jpg"
                alt="EYRA silver jewellery in the workshop"
                fill
                className="object-cover object-center"
                sizes="100vw"
                priority
              />
            </div>
          </FadeIn>
        </div>
      </section>

      <StatsBar />

      {/* Where we started */}
      <section className="bg-white py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <FadeIn>
              <div className="relative w-full aspect-[4/5] overflow-hidden bg-pewter">
                <Image
                  src="/images/brand-2.jpg"
                  alt="A silversmith finishing a band by hand"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </FadeIn>

            <FadeIn delay={100}>
              <div className="max-w-[520px]">
                <h2 className="font-display font-light italic text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.15] text-black mb-6">
                  Where we started
                </h2>
                <div className="flex flex-col gap-5">
                  <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                    We started in a single workshop with a handful of designs and
                    a stubborn rule: nothing leaves unless we would wear it every
                    day ourselves. That rule threw out more prototypes than it
                    kept, and it is still the only quality gate that matters here.
                  </p>
                  <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                    The pieces that survived were the quiet ones. Bands you forget
                    you are wearing. Chains that layer without tangling. Anklets
                    light enough to keep on through a long day. That is the shape
                    the brand took, and we have not drifted from it.
                  </p>
                  <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                    Today we ship across India, still in small batches, still
                    hallmarked, still finished by the same hands.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* What we stand for */}
      <section className="bg-ivory py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <FadeIn>
            <h2 className="font-display font-light italic text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.15] text-black mb-12 max-w-[520px]">
              What we stand for
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14">
            {PILLARS.map((pillar, i) => (
              <FadeIn key={pillar.title} delay={i * 80}>
                <div>
                  <p className="font-sans font-normal text-[0.68rem] tracking-[0.24em] uppercase text-[#909090] mb-4">
                    0{i + 1}
                  </p>
                  <h3 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-3">
                    {pillar.title}
                  </h3>
                  <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                    {pillar.body}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={240}>
            <div className="mt-14 flex flex-wrap gap-6">
              <Link
                href="/craftsmanship"
                className="font-sans font-light text-[16px] text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200"
              >
                How we make it
              </Link>
              <Link
                href="/sustainability"
                className="font-sans font-light text-[16px] text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200"
              >
                Our approach to sustainability
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <CtaBanner />
      <NewsletterBanner />
    </>
  );
}

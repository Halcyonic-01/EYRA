import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionIntro } from "@/components/layout/SectionIntro";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { FadeIn } from "@/components/ui/FadeIn";
import { storeConfig } from "@/config/storeConfig";

export const metadata: Metadata = {
  title: "Craftsmanship",
  description:
    "How EYRA jewellery is made, from 925 sterling stock through hallmarking, finishing, and quality control.",
};

const STEPS = [
  {
    title: "Sourcing the metal",
    body: "We buy 925 sterling stock from assayed suppliers, which means 92.5 percent pure silver alloyed with copper for strength. Fine silver on its own is too soft to hold a shape you can wear daily.",
  },
  {
    title: "Forming",
    body: "Bands are drawn and rolled, chains are linked, and settings are cast in small batches. Working in short runs means a flawed run is caught in tens of pieces rather than thousands.",
  },
  {
    title: "Filing and finishing",
    body: "Every join is filed flush by hand. This is the slowest part of the process and the one that decides whether a ring feels smooth on the inside or catches on your skin.",
  },
  {
    title: "Polishing",
    body: "Pieces are polished in stages, from coarse compound to a final rouge finish. High-shine and brushed textures diverge here, and each takes a different sequence.",
  },
  {
    title: "Hallmarking",
    body: "Pieces are sent for BIS hallmarking, which independently verifies the silver purity. The mark is your proof, not our claim.",
  },
  {
    title: "Anti-tarnish and inspection",
    body: "A protective treatment slows oxidation, then each piece is checked against the sample before it is boxed. Anything that fails goes back rather than out.",
  },
];

const CARE = [
  "Put jewellery on last, after perfume, lotion, and hairspray have dried.",
  "Take it off before swimming, showering, or the gym. Chlorine and sweat both accelerate tarnish.",
  "Store pieces separately in the pouch they came in, away from damp.",
  "Wipe with the soft cloth in your box after wear. This alone prevents most dullness.",
  "For heavier tarnish, warm water with a drop of mild soap and a soft brush, then dry fully.",
];

export default function CraftsmanshipPage() {
  return (
    <>
      <section className="bg-white pb-16">
        <PageHeader
          eyebrow="How it is made"
          title="Craftsmanship"
          standfirst="Good silver is mostly patience. Here is what actually happens between raw sterling stock and the piece that arrives in your box."
          align="center"
        />

        <div className="max-w-screen-xl mx-auto px-6 lg:px-10 mt-12">
          <FadeIn>
            <div className="relative w-full aspect-[16/7] overflow-hidden bg-pewter">
              <Image
                src="/images/brand-2.jpg"
                alt="Hand finishing a sterling silver band"
                fill
                className="object-cover object-center"
                sizes="100vw"
                priority
              />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Process */}
      <section className="bg-ivory py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <FadeIn>
            <SectionIntro eyebrow="The process" title="From stock to finished piece" className="mb-12 lg:mb-16">
              Six stages between raw sterling and your box, with every piece checked against its sample before it is packed.
            </SectionIntro>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {STEPS.map((step, i) => (
              <FadeIn key={step.title} delay={i * 70}>
                <div className="h-full bg-white border border-[#E2E2E2] p-7">
                  <p className="font-display font-light italic text-[2.25rem] leading-none text-[#B0B0B0] mb-4 tabular-nums">
                    0{i + 1}
                  </p>
                  <h3 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-3">
                    {step.title}
                  </h3>
                  <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                    {step.body}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Care */}
      <section className="bg-white py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <FadeIn>
              <div className="max-w-[520px]">
                <p className="font-sans font-normal text-[0.7rem] tracking-[0.28em] uppercase text-[#909090] mb-4">
                  Care
                </p>
                <h2 className="font-display font-light italic text-[clamp(1.85rem,3.5vw,2.75rem)] leading-[1.15] text-black mb-6">
                  Caring for your silver
                </h2>
                <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050] mb-6">
                  Sterling silver tarnishes. That is chemistry, not a defect, and
                  it reverses with a minute of care. Follow these and your pieces
                  will outlast the trend that sold them to you.
                </p>
                <ul className="flex flex-col border-t border-[#E2E2E2]">
                  {CARE.map((tip) => (
                    <li
                      key={tip}
                      className="relative pl-6 py-3 border-b border-[#E2E2E2] font-sans font-light text-[15px] leading-[25px] text-[#505050]"
                    >
                      <span aria-hidden="true" className="absolute left-0 top-[24px] w-2 h-px bg-[#909090]" />
                      {tip}
                    </li>
                  ))}
                </ul>
                <p className="font-sans font-light text-[15px] leading-[25px] text-[#505050] mt-6">
                  Manufacturing defects are covered for{" "}
                  {storeConfig.policy.warrantyMonths} months from delivery. Read
                  the{" "}
                  <Link
                    href="/terms-of-service#warranty"
                    className="text-black underline underline-offset-4 decoration-[#B0B0B0] hover:decoration-black transition-colors duration-200"
                  >
                    warranty terms
                  </Link>
                  , or see the{" "}
                  <Link
                    href="/authenticity-and-care#care"
                    className="text-black underline underline-offset-4 decoration-[#B0B0B0] hover:decoration-black transition-colors duration-200"
                  >
                    full care guide and sizing chart
                  </Link>
                  .
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={100}>
              <div className="relative w-full aspect-[4/5] overflow-hidden bg-pewter">
                <Image
                  src="/images/collection-2.jpg"
                  alt="Polished sterling silver chain detail"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <CtaBanner />
      <NewsletterBanner />
    </>
  );
}

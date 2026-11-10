import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { FadeIn } from "@/components/ui/FadeIn";

export const metadata: Metadata = {
  title: "Sustainability",
  description:
    "What EYRA does to reduce the footprint of its silver jewellery, and what we have not solved yet.",
};

const COMMITMENTS = [
  {
    title: "Recycled silver first",
    body: "Silver is infinitely recyclable without losing quality. We prioritise recycled sterling stock over newly mined metal, and our workshop scrap is collected and refined back into usable silver rather than discarded.",
  },
  {
    title: "Made to demand",
    body: "Small batch production means we are not producing thousands of pieces that end up discounted into landfill. When a design stops selling, we retire it instead of forcing it through a clearance cycle.",
  },
  {
    title: "Plastic-free packaging",
    body: "Boxes are paper-based and the protective pouches are cotton. The only plastic left in the chain is the tamper-evident courier bag, which we are working to replace with a compostable alternative.",
  },
  {
    title: "Repair over replace",
    body: "Solid silver can be re-polished, re-sized, and re-soldered. We would rather fix a piece you already own than sell you a second one, which is why our warranty covers workmanship rather than wear.",
  },
];

const HONEST = [
  {
    q: "Are you carbon neutral?",
    a: "No. We do not buy offsets to make that claim. Our footprint is mostly courier transport, and we are working on consolidating dispatches rather than paying to look neutral on paper.",
  },
  {
    q: "Is all your silver recycled?",
    a: "Not yet, and we will not pretend otherwise. Recycled supply is inconsistent in the quantities we need, so some batches still use newly refined sterling. We report this honestly rather than rounding it up.",
  },
  {
    q: "Are your suppliers audited?",
    a: "We buy assayed stock from established suppliers and verify purity through BIS hallmarking. We do not yet have independent third-party audits of every link upstream, which is the next thing we want to fix.",
  },
];

export default function SustainabilityPage() {
  return (
    <>
      <section className="bg-white pb-16">
        <PageHeader
          eyebrow="Our footprint"
          title="Sustainability"
          standfirst="Jewellery has a real environmental cost. Here is what we do about ours, and where we still fall short."
        />

        <div className="max-w-screen-xl mx-auto px-6 lg:px-10 mt-12">
          <FadeIn>
            <div className="relative w-full aspect-[16/7] overflow-hidden bg-pewter">
              <Image
                src="/images/collection-3.jpg"
                alt="Recycled sterling silver pieces"
                fill
                className="object-cover object-center"
                sizes="100vw"
                priority
              />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Commitments */}
      <section className="bg-ivory py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <FadeIn>
            <h2 className="font-display font-light italic text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.15] text-black mb-12 max-w-[520px]">
              What we commit to
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
            {COMMITMENTS.map((item, i) => (
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
        </div>
      </section>

      {/* What we have not solved */}
      <section className="bg-white py-16 lg:py-24">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <div className="max-w-[760px]">
            <FadeIn>
              <h2 className="font-display font-light italic text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.15] text-black mb-4">
                What we have not solved
              </h2>
              <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050] mb-10">
                Most sustainability pages only list wins. These are the questions
                we get asked and the honest answers.
              </p>
            </FadeIn>

            <div className="flex flex-col gap-8">
              {HONEST.map((item, i) => (
                <FadeIn key={item.q} delay={i * 80}>
                  <div className="border-t border-[#CFCFCF] pt-5">
                    <h3 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-3">
                      {item.q}
                    </h3>
                    <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050]">
                      {item.a}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={240}>
              <p className="font-sans font-light text-[16px] leading-[26px] text-[#505050] mt-10">
                If you think we are getting something wrong here, we would rather
                hear it than not.{" "}
                <Link
                  href="/contact"
                  className="text-black underline underline-offset-4 hover:text-[#626262] transition-colors duration-200"
                >
                  Tell us
                </Link>
                .
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      <CtaBanner />
      <NewsletterBanner />
    </>
  );
}

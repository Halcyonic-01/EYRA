import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { FadeIn } from "@/components/ui/FadeIn";

export function BrandStory() {
  return (
    <section className="bg-ivory py-24 overflow-hidden">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-16">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

          {/* Overlapping pill images */}
          <FadeIn direction="left" className="relative flex-shrink-0 w-full max-w-[340px] lg:max-w-none lg:w-auto">
            <div className="flex items-end justify-center gap-4 lg:gap-5">
              {/* Tall pill */}
              <div
                className="relative overflow-hidden rounded-full flex-shrink-0"
                style={{ width: "clamp(130px, 16vw, 200px)", height: "clamp(210px, 28vw, 360px)" }}
              >
                <Image
                  src="/images/brand-1.jpg"
                  alt="Eyra silver jewellery"
                  fill
                  className="object-cover"
                  sizes="200px"
                />
              </div>
              {/* Short pill, raised up */}
              <div
                className="relative overflow-hidden rounded-full flex-shrink-0 -mt-12"
                style={{ width: "clamp(110px, 13vw, 165px)", height: "clamp(170px, 22vw, 280px)" }}
              >
                <Image
                  src="/images/brand-2.jpg"
                  alt="Eyra craftsmanship"
                  fill
                  className="object-cover"
                  sizes="165px"
                />
              </div>
            </div>
          </FadeIn>

          {/* Text */}
          <FadeIn delay={120} className="max-w-xl text-center lg:text-left flex flex-col gap-6">
            <Logo variant="dark" size="lg" />

            <p className="font-display font-light leading-[1.15] text-[clamp(1.8rem,3.2vw,2.8rem)] text-jet">
              Silver Jewellery Designed for Every Style &amp; Moment
            </p>

            <p className="font-sans font-light text-[0.86rem] leading-relaxed text-carbon">
              At Eyra, we believe jewellery should feel timeless, versatile, and expressive. Our
              collections are crafted using premium 925 sterling silver with attention to precision,
              comfort, and everyday, effortless luxury.
            </p>
            <p className="font-sans font-light text-[0.86rem] leading-relaxed text-carbon">
              Each piece is designed to complement both modern fashion and personal style, easily
              making every detail feel effortlessly refined. Whether layered subtly or styled
              minimally, every Eyra jewellery is made to become part of your identity.
            </p>

            <div>
              <Link
                href="/collections"
                className="inline-flex items-center justify-center bg-jet text-white font-sans text-[0.88rem] tracking-[0.06em] px-8 py-4 rounded-full hover:bg-charcoal transition-colors duration-300"
              >
                Discover Eyra
              </Link>
            </div>
          </FadeIn>

        </div>
      </div>
    </section>
  );
}

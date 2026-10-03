import Image from "next/image";
import Link from "next/link";
import { FadeIn } from "@/components/ui/FadeIn";
import { COLLECTIONS as ALL_COLLECTIONS } from "@/config/collections";

// The product-type collections, taken from the shared config so the homepage
// and the footer always offer the same categories.
const COLLECTIONS = ALL_COLLECTIONS.filter((c) =>
  ["rings", "necklaces", "anklets", "bracelets"].includes(c.slug)
).map((c) => ({
  src: c.image,
  label: c.label,
  href: `/collections/${c.slug}`,
}));

export function CollectionsGrid() {
  return (
    <section className="bg-ivory py-24">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-16">

        {/* Section heading */}
        <FadeIn className="mb-4">
          <p className="font-display italic font-light leading-[1.05] text-[clamp(2.2rem,4.5vw,4rem)] text-jet">
            Explore our signature collections
          </p>
        </FadeIn>

        {/* Subtitle + View all */}
        <FadeIn delay={80} className="mb-14 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <p className="font-sans font-light text-[0.88rem] leading-relaxed text-carbon max-w-lg">
            At Eyra, every piece is thoughtfully crafted using 925 sterling silver to deliver
            elegance, comfort, and durability in perfect balance. Our collections are designed
            for both men and women who appreciate minimal luxury and timeless style.
          </p>
          <Link
            href="/collections"
            className="flex-shrink-0 text-[0.78rem] font-sans font-light tracking-[0.14em] uppercase text-carbon border-b border-carbon pb-px hover:text-jet hover:border-jet transition-colors duration-300 self-start sm:self-auto"
          >
            View all
          </Link>
        </FadeIn>

        {/* 3-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLLECTIONS.map((col, i) => (
            <FadeIn key={col.label} delay={i * 80}>
              <Link href={col.href} className="group block relative overflow-hidden bg-pewter aspect-[3/4]">
                <Image
                  src={col.src}
                  alt={col.label}
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-black/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 px-6 py-6">
                  <p className="font-display font-light text-[1.3rem] tracking-[0.06em] text-white">
                    {col.label}
                  </p>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>

      </div>
    </section>
  );
}

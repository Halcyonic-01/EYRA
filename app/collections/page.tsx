import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { COLLECTIONS, filterByCollection } from "@/config/collections";
import { getProducts } from "@/lib/medusa";

export const metadata: Metadata = {
  title: "Collections",
  description:
    "Explore every EYRA collection of 925 sterling silver jewellery, from stacking rings to layered chains and delicate anklets.",
};

export default async function CollectionsPage() {
  const products = await getProducts();

  return (
    <>
      <section className="bg-white">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10 pt-10 pb-16">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1 font-sans font-normal text-[16px] leading-[24px] mb-8"
          >
            <Link href="/" className="text-[#909090] hover:text-black transition-colors duration-200">
              Home
            </Link>
            <span className="text-[#909090]">/</span>
            <span className="text-black">Collections</span>
          </nav>

          {/* Heading */}
          <div className="max-w-[560px] mb-12">
            <h1 className="font-display font-light italic text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.1] text-black mb-4">
              Collections
            </h1>
            <p className="font-sans font-light text-[18px] leading-[27px] text-[#505050]">
              Every piece is cut from 925 sterling silver, hallmarked and
              finished to resist tarnish. Find the shape that fits you.
            </p>
          </div>

          {/* Collection tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {COLLECTIONS.map((collection) => {
              const count = filterByCollection(products, collection).length;
              return (
                <Link
                  key={collection.slug}
                  href={`/collections/${collection.slug}`}
                  className="group block relative overflow-hidden bg-pewter aspect-[3/4]"
                >
                  <Image
                    src={collection.image}
                    alt={collection.label}
                    fill
                    className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent pointer-events-none" />

                  <div className="absolute bottom-8 left-7 right-7">
                    <h2 className="font-display font-light text-[1.75rem] leading-tight text-white mb-2">
                      {collection.label}
                    </h2>
                    <p className="font-sans font-light text-[0.82rem] leading-relaxed text-white/80 mb-3">
                      {collection.description}
                    </p>
                    <span className="font-sans font-light text-[0.7rem] tracking-[0.2em] uppercase text-white/70">
                      {count} {count === 1 ? "piece" : "pieces"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <CtaBanner />
      <NewsletterBanner />
    </>
  );
}

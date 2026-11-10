import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";
import { getProducts } from "@/lib/medusa";

/** How many pieces to show in the carousel. */
const TRENDING_COUNT = 8;

/**
 * Display order for the most loved pieces, most loved first. Matched against
 * product titles, ignoring case, punctuation, and a leading "The". Products not
 * on this list follow in their catalogue order.
 */
const MOST_LOVED_ORDER = [
  "The Contour Split Ring",
  "The Rope Crossover Band",
  "The Classic Bridge Band",
  "The Inset Crest Ring",
  "The Diamond Cut Square Silver Bracelet",
  "The Daisy Bloom Pendant",
  "The Radiant Butterfly Pendant",
  "The Halo Evil Eye Rose Gold Bracelet",
];

/** Lowercase, drop a leading "the", and strip everything but letters and digits. */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^\s*the\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

const MOST_LOVED_KEYS = MOST_LOVED_ORDER.map(normalizeTitle);

/** Position of a product in MOST_LOVED_ORDER, or Infinity when it is not listed. */
function mostLovedRank(name: string): number {
  const key = normalizeTitle(name);
  const index = MOST_LOVED_KEYS.indexOf(key);
  return index === -1 ? Infinity : index;
}

/**
 * "Most Loved Pieces" carousel.
 *
 * This previously rendered a hardcoded list with invented handles and prices,
 * so every tile linked to a product page that did not exist. It now reads the
 * real catalogue, which keeps names, prices, images, and URLs in sync with
 * what is actually for sale.
 */
export async function TrendingCarousel() {
  // Sort before slicing so the favourites lead, then fill any remaining slots.
  const products = (await getProducts())
    .map((product, catalogueIndex) => ({ product, catalogueIndex }))
    .sort(
      (a, b) =>
        mostLovedRank(a.product.name) - mostLovedRank(b.product.name) ||
        a.catalogueIndex - b.catalogueIndex
    )
    .map(({ product }) => product)
    .slice(0, TRENDING_COUNT);

  if (products.length === 0) return null;

  return (
    <section className="bg-white py-24">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-16">

        {/* Section header */}
        <FadeIn className="mb-4 text-center">
          <p className="font-display italic font-light leading-[1.05] text-[clamp(2.2rem,4.5vw,4rem)] text-jet">
            Most Loved Pieces
          </p>
        </FadeIn>

        <FadeIn delay={80} className="mb-12 text-center">
          <p className="font-sans font-light text-[0.88rem] leading-relaxed text-carbon max-w-xl mx-auto">
            Discover Eyra&rsquo;s most loved silver jewellery timeless essentials chosen for their
            elegance, versatility, and everyday luxury.
          </p>
        </FadeIn>

        {/* Horizontal scroll track. On mobile it bleeds to the screen edges so the
            next tile peeks in, and a visible scrollbar plus a swipe hint show it scrolls. */}
        <FadeIn delay={140}>
          <div className="-mx-6 px-6 lg:mx-0 lg:px-0">
          <div className="carousel-scroll flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory scroll-px-6 lg:scroll-px-0 pb-4">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group flex-shrink-0 snap-start w-[150px] sm:w-[220px]"
              >
                <div className="relative overflow-hidden bg-cloud aspect-square mb-3 rounded-full">
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    sizes="(max-width: 640px) 150px, 220px"
                  />
                </div>
                <p className="font-sans font-light text-[0.75rem] sm:text-[0.82rem] text-carbon text-center leading-snug">
                  {product.name}
                </p>
                <p className="font-sans font-normal text-[0.75rem] sm:text-[0.82rem] text-jet text-center leading-snug mt-1">
                  ₹{product.price.toLocaleString("en-IN")}
                </p>
              </Link>
            ))}
          </div>
          <p className="mt-2 flex items-center justify-end gap-2 font-sans text-[0.7rem] tracking-[0.14em] uppercase text-smoke lg:hidden">
            Swipe to explore
            <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
          </p>
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={200} className="mt-12 flex justify-center">
          <Link
            href="/collections"
            className="inline-flex items-center justify-center bg-jet text-white font-sans text-[0.88rem] tracking-[0.06em] px-8 py-4 rounded-full hover:bg-charcoal transition-colors duration-300"
          >
            Explore more
          </Link>
        </FadeIn>

      </div>
    </section>
  );
}

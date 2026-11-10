import type { Metadata } from "next";
import Link from "next/link";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { ProductGrid } from "@/components/products/ProductGrid";
import { getProducts } from "@/lib/medusa";

export const metadata: Metadata = {
  title: "New Arrivals",
  description:
    "The latest 925 sterling silver pieces to join the EYRA catalogue, fresh from the workshop.",
};

/** How many of the most recent pieces to surface as "new". */
const NEW_ARRIVAL_COUNT = 12;

export default async function NewArrivalsPage() {
  // getProducts returns the catalogue in Medusa's creation order, so the tail
  // of the list is the most recently added stock.
  const products = await getProducts();
  const newest = [...products].reverse().slice(0, NEW_ARRIVAL_COUNT);

  return (
    <>
      <section className="bg-white">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10 pt-10 pb-16">
          {/* Heading */}
          <div className="max-w-[560px] mb-10">
            <h1 className="font-display font-light italic text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.1] text-black mb-4">
              New Arrivals
            </h1>
            <p className="font-sans font-light text-[18px] leading-[27px] text-[#505050]">
              The newest silver to leave the workshop. Small batches, hallmarked
              and finished by hand.
            </p>
          </div>

          <div className="flex items-end justify-between mb-6">
            <p className="font-sans font-normal text-[16px] text-[#626262]">
              {newest.length} {newest.length === 1 ? "result" : "results"}
            </p>
            <Link
              href="/products"
              className="font-sans font-light text-[16px] text-[#505050] underline underline-offset-2 hover:text-black transition-colors duration-200"
            >
              View all jewellery
            </Link>
          </div>

          <ProductGrid products={newest} />
        </div>
      </section>

      <CtaBanner />
      <NewsletterBanner />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { ProductGrid } from "@/components/products/ProductGrid";
import { getProducts } from "@/lib/medusa";

export const metadata: Metadata = {
  title: "Best Sellers",
  description:
    "The EYRA pieces customers reach for most, in certified 925 sterling silver.",
};

const BEST_SELLER_COUNT = 12;

export default async function BestSellersPage() {
  // Ordered by the catalogue's own merchandising order, which is the same
  // signal the products page calls "Trending". Swap this for real sales data
  // once order volume per variant is being aggregated.
  const products = (await getProducts()).slice(0, BEST_SELLER_COUNT);

  return (
    <>
      <section className="bg-white">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10 pt-10 pb-16">
          <div className="max-w-[560px] mb-10">
            <h1 className="font-display font-light italic text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.1] text-black mb-4">
              Best Sellers
            </h1>
            <p className="font-sans font-light text-[18px] leading-[27px] text-[#505050]">
              The pieces that leave the workshop fastest. Hallmarked 925 sterling
              silver, finished by hand.
            </p>
          </div>

          <div className="flex items-end justify-between mb-6">
            <p className="font-sans font-normal text-[16px] text-[#626262]">
              {products.length} {products.length === 1 ? "result" : "results"}
            </p>
            <Link
              href="/products"
              className="font-sans font-light text-[16px] text-[#505050] underline underline-offset-2 hover:text-black transition-colors duration-200"
            >
              View all jewellery
            </Link>
          </div>

          <ProductGrid products={products} />
        </div>
      </section>

      <CtaBanner />
      <NewsletterBanner />
    </>
  );
}

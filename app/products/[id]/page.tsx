import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/products/ProductDetailClient";
import { ProductGrid } from "@/components/products/ProductGrid";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { getProducts, getProductByHandle, getSimilarProducts } from "@/lib/medusa";
import { storeConfig } from "@/config/storeConfig";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductByHandle(id);
  if (!product) return { title: "Product Not Found" };
  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, similar] = await Promise.all([
    getProductByHandle(id),
    getSimilarProducts(id, 8),
  ]);
  if (!product) notFound();

  return (
    <>
      <ProductDetailClient
        product={product}
        policy={{
          returnDays: storeConfig.policy.returnDays,
          exchangeDays: storeConfig.policy.exchangeDays,
        }}
      />

      {/* ── Similar products ─────────────────────── */}
      <section className="bg-white py-16">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">

          {/* Section header */}
          <div className="flex items-end justify-between mb-10">
            <h2 className="font-display font-light italic text-[clamp(2rem,4vw,3rem)] leading-[1.1] text-black">
              Similar products
            </h2>
            <Link
              href="/products"
              className="font-sans font-light text-[18px] leading-[27px] text-[#505050] underline underline-offset-2 hover:text-black transition-colors duration-200 hidden sm:block"
            >
              View more jewellery
            </Link>
          </div>

          {/* Same cards as the products page: hover, swipe, offer line */}
          <ProductGrid products={similar} />

          {/* Mobile "view more" link */}
          <div className="mt-8 flex justify-center sm:hidden">
            <Link
              href="/products"
              className="font-sans font-light text-[16px] text-[#505050] underline underline-offset-2 hover:text-black transition-colors duration-200"
            >
              View more jewellery
            </Link>
          </div>
        </div>
      </section>

      <CtaBanner />
      <NewsletterBanner />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { ProductGrid } from "@/components/products/ProductGrid";
import {
  ROUTABLE_SLUGS,
  canonicalSlug,
  filterByCollection,
  getCollection,
} from "@/config/collections";
import { getProducts } from "@/lib/medusa";

// Collections are a fixed, known set, so anything outside it is a genuine 404.
// Without this, Next streams a 200 shell (the root loading.tsx opens a Suspense
// boundary before this component runs) and an unknown slug becomes a soft 404
// that crawlers index as a real page.
export const dynamicParams = false;

export function generateStaticParams() {
  return ROUTABLE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) return { title: "Collection Not Found" };
  return {
    title: collection.label,
    description: collection.description,
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // "New" is a recency view rather than a product type, and lives at its own
  // top-level route. The homepage hero still links here, so keep it resolving.
  if (slug === "new") redirect("/new-arrivals");

  // Send aliases (/collections/necklaces, /collections/chains) to the canonical URL so there is a
  // single indexable address per collection.
  const canonical = canonicalSlug(slug);
  if (canonical) redirect(`/collections/${canonical}`);

  const collection = getCollection(slug);
  if (!collection) notFound();

  const allProducts = await getProducts();
  const products = filterByCollection(allProducts, collection);

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
            <Link
              href="/collections"
              className="text-[#909090] hover:text-black transition-colors duration-200"
            >
              Collections
            </Link>
            <span className="text-[#909090]">/</span>
            <span className="text-black">{collection.label}</span>
          </nav>

          {/* Heading */}
          <div className="max-w-[560px] mb-10">
            <h1 className="font-display font-light italic text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.1] text-black mb-4">
              {collection.label}
            </h1>
            <p className="font-sans font-light text-[18px] leading-[27px] text-[#505050]">
              {collection.description}
            </p>
          </div>

          {/* Count + link to full catalogue */}
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

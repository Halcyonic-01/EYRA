import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CollectionFilter } from "@/components/collections/CollectionFilter";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { ProductGrid } from "@/components/products/ProductGrid";
import {
  ROUTABLE_SLUGS,
  canonicalSlug,
  filterByCollection,
  getCollection,
  getNarrowingCollections,
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const { filter } = await searchParams;

  // "New" is a recency view rather than a product type, and lives at its own
  // top-level route. The homepage hero still links here, so keep it resolving.
  if (slug === "new") redirect("/new-arrivals");

  // Send aliases (/collections/necklaces, /collections/chains) to the canonical URL so there is a
  // single indexable address per collection.
  const canonical = canonicalSlug(slug);
  if (canonical) redirect(`/collections/${canonical}`);

  const collection = getCollection(slug);
  if (!collection) notFound();

  // The narrowing buttons: For Her / For Him on a product-type page, and the
  // product types on an audience page. Only a known option can narrow the list.
  const narrowers = getNarrowingCollections(collection);
  const active = narrowers.find((c) => c.slug === filter) ?? null;

  const allProducts = await getProducts();
  let products = filterByCollection(allProducts, collection);
  if (active) products = filterByCollection(products, active);

  return (
    <>
      <section className="bg-white">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10 pt-10 pb-16">
          {/* Heading */}
          <div className="max-w-[560px] mb-10">
            <h1 className="font-display font-light italic text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.1] text-black">
              <Link
                href={`/collections/${collection.slug}`}
                scroll={false}
                className="hover:opacity-70 transition-opacity duration-200"
              >
                {collection.label}
              </Link>
            </h1>
            <CollectionFilter
              base={collection}
              options={narrowers}
              active={active}
            />
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

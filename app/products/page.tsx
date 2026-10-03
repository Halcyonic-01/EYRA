import type { Metadata } from "next";
import { ProductsClient } from "@/components/products/ProductsClient";
import { CtaBanner } from "@/components/home/CtaBanner";
import { NewsletterBanner } from "@/components/home/NewsletterBanner";
import { getProducts } from "@/lib/medusa";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse our full collection of premium 925 sterling silver jewellery: rings, chains, anklets and more.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const products = await getProducts();
  const { q } = await searchParams;

  return (
    <>
      <ProductsClient products={products} initialQuery={q ?? ""} />
      <CtaBanner />
      <NewsletterBanner />
    </>
  );
}

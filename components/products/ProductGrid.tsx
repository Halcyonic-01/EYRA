import Link from "next/link";
import { ProductCard } from "./ProductCard";
import type { Product } from "./types";

/**
 * The bordered product grid shared by the products page and every collection
 * page, so a collection listing is visually identical to /products.
 */
export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="font-sans font-normal text-[18px] text-[#909090] text-center">
          Nothing here just yet. New pieces land every few weeks.
        </p>
        <Link
          href="/products"
          className="font-sans font-medium text-[14px] text-black underline underline-offset-2 hover:text-[#626262] transition-colors duration-200"
        >
          Browse all jewellery
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {products.map((product) => (
        <div key={product.id}>
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );
}

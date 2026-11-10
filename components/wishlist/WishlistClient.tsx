"use client";

import Link from "next/link";
import { useWishlistStore } from "@/store/useStore";
import { ProductGrid } from "@/components/products/ProductGrid";

export function WishlistClient() {
  const items = useWishlistStore((s) => s.items);

  if (items.length === 0) {
    return (
      <div className="max-w-screen-xl mx-auto px-6 lg:px-10 py-24 flex flex-col items-center gap-6">
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#CFCFCF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <p className="font-sans font-normal text-[20px] text-[#909090]">Your wishlist is empty</p>
        <Link
          href="/products"
          className="px-8 py-[14px] bg-black text-white font-sans font-medium text-[16px] rounded-full hover:bg-[#1a1a1a] transition-colors duration-200"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-screen-xl mx-auto px-6 lg:px-10 pt-10">
        <h1 className="font-sans font-medium text-[24px] leading-[36px] text-black">
          Wishlist ({items.length} {items.length === 1 ? "item" : "items"})
        </h1>
      </div>

      {/* Same product card grid as the products page */}
      <div className="max-w-screen-xl mx-auto px-6 lg:px-10 py-8">
        <ProductGrid products={items.map((item) => item.product)} />
      </div>
    </>
  );
}

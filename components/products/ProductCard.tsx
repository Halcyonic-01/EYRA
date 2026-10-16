"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "./types";
import { useCartStore, useWishlistStore } from "@/store/useStore";

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const addToCart = useCartStore((s) => s.addToCart);
  // Rings have one variant per size (checked live: every ring in the
  // catalogue has 15 size variants, every chain has exactly 1), so
  // "in cart" can't just mean "any variant of this product" for rings, or
  // adding a different size would read as a no-op. Non-ring products are
  // single-variant, so the broader check is accurate for them.
  const inCart = useCartStore((s) =>
    product.type === "ring"
      ? false
      : s.items.some((i) => i.product.id === product.id)
  );
  const wishlisted = useWishlistStore((s) =>
    s.items.some((i) => i.product.id === product.id)
  );
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  return (
    <article className="group flex flex-col items-center gap-3 p-4 h-full bg-white hover:bg-[#F7F7F7] border border-[#CFCFCF] rounded-2xl transition-colors duration-200">
      {/* Image container */}
      <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden">
        <button
          type="button"
          onClick={() => toggleWishlist(product, product.type === "ring" ? undefined : product.variantId)}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wishlisted}
          className="absolute top-0 left-0 p-1 flex items-center justify-center z-10"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
        </button>
        <Link
          href={`/products/${product.id}`}
          aria-label="View product"
          className="absolute top-0 right-0 w-[42px] h-[42px] rounded-full bg-white border border-[#B4B4B4] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </Link>

        <Link href={`/products/${product.id}`} className="relative w-[85%] h-[85%]">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 206px"
          />
        </Link>
      </div>

      {/* Product info */}
      <div className="flex flex-col items-center gap-1 w-full">
        <h3 className="font-sans font-normal text-[16px] leading-[24px] text-center text-black w-full line-clamp-1">
          <Link href={`/products/${product.id}`} className="hover:underline underline-offset-2">
            {product.name}
          </Link>
        </h3>
        <div className="flex items-center gap-[13px] mt-1">
          <span className="font-sans font-medium text-[18px] leading-[28px] text-black">
            ₹{product.price.toLocaleString("en-IN")}
          </span>
          <span className="font-sans font-normal text-[15px] leading-[22px] text-[#AAAAAA] line-through">
            ₹{product.originalPrice.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Add to cart */}
      <div className="mt-auto w-full flex justify-center">
        <button
          onClick={(e) => {
            e.preventDefault();
            if (product.type === "ring") {
              // Rings need a size, and this card has no size picker. Sending
              // customers to the PDP to choose one beats silently adding
              // whichever size Medusa happens to list first.
              router.push(`/products/${product.id}`);
              return;
            }
            if (!inCart) addToCart(product, null, product.variantId);
          }}
          className={`w-full max-w-[310px] flex items-center justify-center px-4 sm:px-8 py-2.5 font-sans font-medium text-[14px] sm:text-[16px] leading-[20px] whitespace-nowrap rounded-full transition-colors duration-200 ${inCart
              ? "bg-black text-white"
              : "bg-black text-white hover:bg-[#1a1a1a]"
            }`}
          style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
        >
          {inCart ? "Added to cart" : "Add to cart"}
        </button>
      </div>
    </article>
  );
}

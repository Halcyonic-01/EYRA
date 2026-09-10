"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWishlistStore, useCartStore } from "@/store/useStore";
import type { WishlistItem } from "@/store/useStore";

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DE2E2E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export function WishlistClient() {
  const router = useRouter();
  const items = useWishlistStore((s) => s.items);
  const removeFromWishlist = useWishlistStore((s) => s.remove);
  const addToCart = useCartStore((s) => s.addToCart);
  const cartItems = useCartStore((s) => s.items);

  function moveToCart(item: WishlistItem) {
    if (!item.variantId) {
      // Wishlisted without a size chosen. Sending them to the PDP beats
      // silently adding a cart item with no variant, which used to add
      // locally with no server sync, since addToCart no-ops the Medusa
      // sync whenever variantId is missing.
      router.push(`/products/${item.product.id}`);
      return;
    }
    // Pass the saved size through, otherwise the cart line is keyed on
    // `null` and shows no size at all, even though variantId pins the cart to
    // a specific one. The customer could not see which size they were buying.
    addToCart(item.product, item.size ?? null, item.variantId);
    removeFromWishlist(item.product.id);
  }

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
    <div className="max-w-screen-xl mx-auto px-6 lg:px-10 py-10 pb-20">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 font-sans font-normal text-[16px] leading-[24px] mb-8">
        <Link href="/" className="text-[#5F5F5F] hover:text-black transition-colors duration-200">Home</Link>
        <span className="text-[#5F5F5F] mx-1">›</span>
        <span className="text-black">Wishlist</span>
      </nav>

      <h1 className="font-sans font-medium text-[24px] leading-[36px] text-black mb-8">
        Wishlist ({items.length} {items.length === 1 ? "item" : "items"})
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-[#CFCFCF]">
        {items.map((item) => {
          const { product, variantId } = item;
          // Match the size too, not just the product. Rings carry one variant
          // per size, so "this product is somewhere in the cart" would disable
          // "Move to cart" for a size-8 ring merely because a size-12 of the
          // same ring was already in there. ProductCard draws the same
          // distinction for the same reason.
          const inCart = cartItems.some(
            (c) =>
              c.product.id === product.id &&
              (product.type === "ring" ? c.size === (item.size ?? null) : true)
          );

          return (
            <div key={product.id} className="relative border-b border-r border-[#CFCFCF] flex flex-col items-center gap-4 py-8 px-6 group hover:bg-[#F7F7F7] transition-colors duration-200">
              {/* Quick-view button, visible on hover */}
              <Link
                href={`/products/${product.id}`}
                aria-label="View product"
                className="absolute top-3 right-3 w-[42px] h-[42px] rounded-full bg-white border border-[#B4B4B4] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </Link>

              {/* Product image */}
              <Link href={`/products/${product.id}`} className="relative w-full aspect-square flex items-center justify-center overflow-hidden">
                <div className="relative w-[70%] h-[70%]">
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    className="object-contain transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 25vw"
                  />
                </div>
              </Link>

              {/* Info */}
              <div className="flex flex-col items-center gap-1 w-full text-center">
                <Link href={`/products/${product.id}`} className="font-sans font-normal text-[20px] leading-[30px] text-black hover:underline underline-offset-2">
                  {product.name}
                </Link>
                <p className="font-sans font-normal text-[15px] leading-[22px] text-[#A0A0A0] line-clamp-2">
                  {product.description}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="font-sans font-medium text-[22px] leading-[33px] text-black">
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                  <span className="font-sans font-normal text-[18px] leading-[27px] text-[#AAAAAA] line-through">
                    ₹{product.originalPrice.toLocaleString("en-IN")}
                  </span>
                </div>
                {/* Surface when no variant could be resolved so the user knows to pick a size on PDP */}
                {!variantId && (
                  <p className="font-sans text-[11px] text-[#909090] mt-0.5">
                    Visit product page to select a size before adding to cart.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 w-full mt-auto">
                <button
                  onClick={() => moveToCart(item)}
                  disabled={inCart}
                  className="flex-1 max-w-[310px] flex items-center justify-center px-8 py-[14px] bg-black text-white font-sans font-medium text-[16px] leading-[20px] rounded-full hover:bg-[#1a1a1a] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
                  style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
                >
                  {inCart ? "In cart" : variantId ? "Move to cart" : "Select size"}
                </button>
                <button
                  aria-label="Remove from wishlist"
                  onClick={() => removeFromWishlist(product.id)}
                  className="w-[50px] h-[50px] flex-shrink-0 rounded-full bg-white flex items-center justify-center hover:bg-[#FFF0F0] transition-colors duration-200"
                  style={{ border: "1px solid #C1C1C1" }}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

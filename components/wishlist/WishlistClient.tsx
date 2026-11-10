"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWishlistStore, useCartStore } from "@/store/useStore";
import type { WishlistItem } from "@/store/useStore";
import { sameSize } from "@/lib/variant-selection";
import { COD_CHARGE, rupees } from "@/config/offers";
import type { ProductPolicy } from "@/components/products/ProductDetailClient";

/* ── Inline SVG icons (same set as the product page) ─ */

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill={filled ? "#E74C3C" : "none"} stroke={filled ? "#E74C3C" : "#545454"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#696969" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function ExchangeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#696969" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 16H3v-4" /><path d="M3 12a9 9 0 0 1 14.12-7.37" />
      <path d="M17 8h4v4" /><path d="M21 12a9 9 0 0 1-14.12 7.37" />
    </svg>
  );
}

function CodIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#696969" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12" /><path d="M6 8h8" /><path d="M6 13l8.5 8" />
      <path d="M6 13h3a4 4 0 0 0 0-8" />
    </svg>
  );
}

export function WishlistClient({ policy }: { policy: ProductPolicy }) {
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

  const serviceItems = [
    { icon: <ReturnIcon />, label: `${policy.returnDays} Days Return` },
    { icon: <ExchangeIcon />, label: `${policy.exchangeDays} Days Exchange` },
    { icon: <CodIcon />, label: `Cash On Delivery (+${rupees(COD_CHARGE)})` },
  ];

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

      {/* ── Wishlist items: same two-column block as the product page ── */}
      <section className="bg-[#F7F7F7] py-10 lg:py-14 mt-8">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10 flex flex-col gap-12 lg:gap-16">
          {items.map((item) => {
            const { product, variantId } = item;
            // Match the size too, not just the product. Rings carry one variant
            // per size, so "this product is somewhere in the cart" would disable
            // "Move to cart" for a size-8 ring merely because a size-12 of the
            // same ring was already in there.
            const inCart = cartItems.some(
              (c) =>
                c.product.id === product.id &&
                sameSize(c.size, item.size)
            );

            return (
              <div key={product.id} className="flex flex-col lg:flex-row gap-8 lg:gap-14 items-start">

                {/* Left: image panel, framed like the product gallery */}
                <div className="w-full lg:w-[45%] flex-shrink-0">
                  <div className="relative bg-white border border-[#CFCFCF] flex flex-col" style={{ minHeight: 436 }}>

                    {/* Top controls */}
                    <div className="flex items-start justify-end px-[18px] pt-5">
                      <button
                        aria-label="Remove from wishlist"
                        onClick={() => removeFromWishlist(product.id)}
                        className="w-[42px] h-[42px] rounded-full bg-white border border-[#DDDDDD] flex items-center justify-center hover:border-black transition-colors duration-200"
                      >
                        <HeartIcon filled />
                      </button>
                    </div>

                    {/* Image */}
                    <Link
                      href={`/products/${product.id}`}
                      className="relative flex-1 mx-2.5 mt-4 mb-5"
                      style={{ minHeight: 360 }}
                    >
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-contain p-4 transition-transform duration-500 hover:scale-105"
                        sizes="(max-width: 1024px) 90vw, 45vw"
                      />
                    </Link>
                  </div>
                </div>

                {/* Right: product info, same type scale as the product page */}
                <div className="w-full lg:flex-1 flex flex-col gap-6">
                  <div className="flex flex-col gap-[7px]">
                    <Link
                      href={`/products/${product.id}`}
                      className="font-sans font-medium text-[20px] leading-[30px] text-black hover:underline underline-offset-2"
                    >
                      {product.name}
                    </Link>
                    <p className="font-sans font-normal text-[16px] leading-[24px] text-[#A0A0A0]">
                      {product.description}
                    </p>

                    {/* Price row */}
                    <div className="flex items-center flex-wrap gap-3 mt-2">
                      <span className="font-sans font-medium text-[24px] leading-[36px] text-black">
                        ₹{product.price.toLocaleString("en-IN")}
                      </span>
                      <span className="font-sans font-normal text-[20px] leading-[30px] text-[#AAAAAA] line-through">
                        ₹{product.originalPrice.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="font-sans font-normal text-[15px] leading-[22px] text-[#BABABA]">
                      Inclusive of all taxes
                    </p>

                    {/* Chosen size, or a prompt when a ring was saved without one */}
                    {(item.size || product.type === "ring") && (
                      <p className="font-sans font-medium text-[14px] leading-[21px] text-black mt-2">
                        {item.size
                          ? `${product.type === "ring" ? "Ring Size" : "Size"}: ${item.size}`
                          : "Ring size not selected"}
                      </p>
                    )}
                    {/* Surface when no variant could be resolved so the user knows to pick a size on PDP */}
                    {!variantId && (
                      <p className="font-sans text-[13px] leading-[20px] text-[#909090]">
                        Visit product page to select a size before adding to cart.
                      </p>
                    )}
                  </div>

                  {/* CTA buttons, same pair and styling as the product page */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => moveToCart(item)}
                      disabled={inCart}
                      className="flex-1 flex items-center justify-center px-4 sm:px-8 py-3 sm:py-[14px] bg-black text-white font-sans font-medium text-[15px] sm:text-[18px] leading-[20px] whitespace-nowrap rounded-full hover:bg-[#1a1a1a] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
                      style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
                    >
                      {inCart ? "In cart" : variantId ? "Move to cart" : "Select size"}
                    </button>
                    <Link
                      href={`/products/${product.id}`}
                      className="flex-1 flex items-center justify-center px-4 sm:px-8 py-3 sm:py-[14px] font-sans font-medium text-[15px] sm:text-[18px] leading-[20px] whitespace-nowrap rounded-full border bg-white text-black border-[#DBDBDB] hover:border-black transition-colors duration-200"
                      style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
                    >
                      View product
                    </Link>
                  </div>

                  {/* Service badges */}
                  <div className="flex border border-[#C5C5C5] rounded-[20px] overflow-hidden">
                    {serviceItems.map((service, i) => (
                      <div
                        key={service.label}
                        className={`flex-1 flex flex-col items-center gap-[5px] py-3 ${
                          i < serviceItems.length - 1 ? "border-r border-[#C5C5C5]" : ""
                        }`}
                      >
                        {service.icon}
                        <span className="font-sans font-normal text-[12px] leading-[18px] text-[#696969] text-center">
                          {service.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

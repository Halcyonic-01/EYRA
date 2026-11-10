"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type MouseEvent, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "./types";
import { useCartStore, useWishlistStore } from "@/store/useStore";
import { productOfferFor, rupees } from "@/config/offers";

/** A horizontal swipe must travel this far (px) and beat the vertical movement to count. */
const SWIPE_MIN_PX = 40;

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const [imageIndex, setImageIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // Set when a swipe just happened, so the link under the finger doesn't navigate.
  const swipedRef = useRef(false);
  const addToCart = useCartStore((s) => s.addToCart);
  // A product with several variants (a ring's sizes, an anklet's single or
  // pair) can't say "in cart" for the product as a whole, or adding a
  // different variant would read as a no-op. Single-variant products can.
  const needsChoice = product.type === "ring" || product.needsChoice === true;
  const inCart = useCartStore((s) =>
    needsChoice ? false : s.items.some((i) => i.product.id === product.id)
  );
  const wishlisted = useWishlistStore((s) =>
    s.items.some((i) => i.product.id === product.id)
  );
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const imageCount = product.images.length;
  // The offer depends on this product's own price: WELCOME200, EYRA350 or EYRA650.
  const productOffer = productOfferFor(product.price);

  function handleTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    swipedRef.current = false;
  }

  function handleTouchEnd(e: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || imageCount < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;
    swipedRef.current = true;
    // Swipe left goes to the next image, swipe right to the previous one. No wrap-around.
    setImageIndex((i) =>
      dx < 0 ? Math.min(i + 1, imageCount - 1) : Math.max(i - 1, 0)
    );
  }

  function handleImageLinkClick(e: MouseEvent) {
    if (swipedRef.current) {
      e.preventDefault();
      swipedRef.current = false;
    }
  }

  return (
    <article className="group flex flex-col items-center gap-3 p-4 h-full bg-white border border-[#CFCFCF] rounded-2xl">
      {/* Image container: white, the same as the card, so photos never sit in a different tone */}
      <div
        className="relative w-full aspect-square bg-white flex items-center justify-center overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={() => toggleWishlist(product, needsChoice ? undefined : product.variantId)}
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

        <Link
          href={`/products/${product.id}`}
          onClick={handleImageLinkClick}
          className="relative w-[85%] h-[85%]"
        >
          {product.images.map((src, i) => (
            <Image
              key={src + i}
              src={src}
              alt={i === 0 ? product.name : ""}
              aria-hidden={i === 0 ? undefined : true}
              fill
              className={`object-contain transition-opacity duration-300 ${
                i === imageIndex ? "opacity-100" : "opacity-0"
              }`}
              sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 206px"
            />
          ))}
        </Link>

        {/* Arrows and dots share one row at the bottom, so they sit on the same line. Hidden for single-image products. */}
        {imageCount > 1 && (
          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between z-10">
            {/* Desktop arrows. Touch screens swipe instead, so these are hidden below lg. */}
            <button
              type="button"
              onClick={() => setImageIndex((i) => Math.max(i - 1, 0))}
              disabled={imageIndex === 0}
              aria-label="Previous image"
              className="hidden lg:flex w-8 h-8 shrink-0 items-center justify-center rounded-full bg-white border border-[#CFCFCF] text-black transition-opacity duration-200 disabled:opacity-30 disabled:cursor-default"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            {/* One dot per image */}
            <div className="flex items-center gap-1.5 mx-auto">
              {product.images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImageIndex(i)}
                  aria-label={`Show image ${i + 1} of ${imageCount}`}
                  aria-current={i === imageIndex}
                  className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                    i === imageIndex ? "bg-black" : "bg-[#CFCFCF]"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setImageIndex((i) => Math.min(i + 1, imageCount - 1))}
              disabled={imageIndex === imageCount - 1}
              aria-label="Next image"
              className="hidden lg:flex w-8 h-8 shrink-0 items-center justify-center rounded-full bg-white border border-[#CFCFCF] text-black transition-opacity duration-200 disabled:opacity-30 disabled:cursor-default"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="flex flex-col items-center gap-1 w-full">
        <h3 className="font-sans font-normal text-[14px] leading-[20px] text-center text-black w-full line-clamp-2">
          <Link href={`/products/${product.id}`} className="hover:underline underline-offset-2">
            {product.name}
          </Link>
        </h3>
        <div className="flex items-center gap-[10px] mt-0.5">
          <span className="font-sans font-medium text-[15px] leading-[22px] text-black">
            {product.hasPriceRange ? "From " : ""}₹{product.price.toLocaleString("en-IN")}
          </span>
          <span className="font-sans font-normal text-[13px] leading-[20px] text-[#AAAAAA] line-through">
            ₹{product.originalPrice.toLocaleString("en-IN")}
          </span>
        </div>
        {productOffer && (
          // Flows as one horizontal line and only breaks between the two parts, so it takes less height.
          <p className="flex flex-wrap items-baseline justify-center gap-x-1 font-sans font-normal text-[12px] leading-[16px] text-[#3D3D3D] text-center">
            <span className="whitespace-nowrap">
              Get it for {product.hasPriceRange ? "from " : ""}
              <span className="font-medium text-black">{rupees(product.price - productOffer.amount)}</span>
            </span>
            <span className="whitespace-nowrap text-[#909090]">with {productOffer.code}</span>
          </p>
        )}
      </div>

      {/* Add to cart */}
      <div className="mt-auto w-full flex justify-center">
        <button
          onClick={(e) => {
            e.preventDefault();
            if (needsChoice) {
              // The customer has a choice to make (a ring size, single or
              // pair, with or without a chain) and this card has no picker.
              // Sending them to the product page beats silently adding
              // whichever variant Medusa happens to list first.
              router.push(`/products/${product.id}`);
              return;
            }
            if (!inCart) addToCart(product, null, product.variantId);
          }}
          className={`w-full max-w-[200px] flex items-center justify-center px-5 py-1.5 font-sans font-medium text-[11px] leading-[16px] whitespace-nowrap rounded-full transition-colors duration-200 ${inCart
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

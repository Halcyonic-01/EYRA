"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { DetailProduct } from "@/lib/products";
import { useCartStore, useWishlistStore } from "@/store/useStore";
import { SIZE_CHART } from "@/lib/sizing";
import { usePincodeServiceability } from "@/lib/hooks/usePincodeServiceability";
import { formatDeliveryRange } from "@/lib/delivery-date";

/* ── Inline SVG icons ────────────────────────────── */

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={filled ? "#F2C822" : "#E5E5E5"}
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#545454" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill={filled ? "#E74C3C" : "none"} stroke={filled ? "#E74C3C" : "#545454"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
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

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

/* ── Main component ──────────────────────────────── */

/**
 * Policy windows shown on the service badges. These are passed in from the
 * server page rather than read from storeConfig here: only NEXT_PUBLIC_ env
 * vars reach the browser, so a client component reading storeConfig directly
 * would silently show the built-in defaults whenever an override is set.
 */
export interface ProductPolicy {
  returnDays: number;
  exchangeDays: number;
}

export function ProductDetailClient({
  product,
  policy,
}: {
  product: DetailProduct;
  policy: ProductPolicy;
}) {
  const router = useRouter();
  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [sizeRequiredError, setSizeRequiredError] = useState(false);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [pincode, setPincode] = useState("");
  const pincodeCheck = usePincodeServiceability();
  const touchStartX = useRef<number>(0);

  const addToCart = useCartStore((s) => s.addToCart);
  const cartItems = useCartStore((s) => s.items);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const wishlist = useWishlistStore((s) => s.items.some((i) => i.product.id === product.id));
  const inCart = cartItems.some(
    (i) => i.product.id === product.id && i.size === (product.type === "ring" ? selectedSize : null)
  );

  /**
   * Resolves which variant an add-to-cart/buy-now action should use.
   *
   * Rings previously fell back to product.variantId (the "cheapest" variant,
   * arbitrary among same-priced sizes) whenever no size was selected, so a
   * customer who never picked a size would silently get whatever size Medusa
   * happened to list first. Returns null and flags the size picker instead of
   * guessing.
   */
  function resolveVariantId(): string | undefined | null {
    if (product.type !== "ring") return product.variantId;
    if (!selectedSize) {
      setSizeRequiredError(true);
      return null;
    }
    return product.sizeVariantMap?.[String(selectedSize)] ?? product.variantId;
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) setActiveImage((i) => Math.min(product.images.length - 1, i + 1));
      else setActiveImage((i) => Math.max(0, i - 1));
    }
  }


  const serviceItems = [
    { icon: <ReturnIcon />, label: `${policy.returnDays} Days Return` },
    { icon: <ExchangeIcon />, label: `${policy.exchangeDays} Days Exchange` },
    { icon: <CodIcon />, label: "Cash On Delivery" },
  ];

  return (
    <>
      {/* ── Product detail section ─────────────────── */}
      <section className="bg-[#F7F7F7] py-10 lg:py-14">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-14 items-start">

            {/* Left: Image gallery */}
            <div className="w-full lg:w-[45%] flex-shrink-0">
              {/* Main image container */}
              <div className="relative bg-white border border-[#CFCFCF] flex flex-col" style={{ minHeight: 436 }}>

                {/* Top controls */}
                <div className="flex items-start justify-between px-[18px] pt-5">
                  <button
                    className="border border-[#E4C23C] text-[#473900] font-sans font-normal text-[15px] leading-[22px] px-[10px] py-[5px] rounded-[333px] bg-white/90"
                    style={{ backdropFilter: "blur(4px)" }}
                  >
                    Try it on
                  </button>
                  <div className="flex gap-1">
                    <button
                      aria-label="Share"
                      className="w-[42px] h-[42px] rounded-full bg-white border border-[#DDDDDD] flex items-center justify-center hover:border-black transition-colors duration-200"
                    >
                      <ShareIcon />
                    </button>
                    <button
                      aria-label={wishlist ? "Remove from wishlist" : "Add to wishlist"}
                      onClick={() => {
                        // Unlike add-to-cart, wishlisting a ring without a
                        // size picked is fine, WishlistClient shows a "pick a
                        // size" prompt for that case. What it must not do is
                        // silently store an arbitrary size as if chosen.
                        const variantId =
                          product.type === "ring"
                            ? selectedSize
                              ? product.sizeVariantMap?.[String(selectedSize)]
                              : undefined
                            : product.variantId;
                        // Save the size alongside the variant so moving this
                        // to the cart later can label the line with it.
                        toggleWishlist(
                          product,
                          variantId,
                          product.type === "ring" ? selectedSize : null
                        );
                      }}
                      className="w-[42px] h-[42px] rounded-full bg-white border border-[#DDDDDD] flex items-center justify-center hover:border-black transition-colors duration-200"
                    >
                      <HeartIcon filled={wishlist} />
                    </button>
                  </div>
                </div>

                {/* Main image */}
                <div
                  className="relative flex-1 mx-2.5 mt-4 mb-0 cursor-grab active:cursor-grabbing select-none"
                  style={{ minHeight: 280 }}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <Image
                    src={product.images[activeImage]}
                    alt={`${product.name}, view ${activeImage + 1}`}
                    fill
                    className="object-contain p-4 transition-opacity duration-300"
                    priority
                    sizes="(max-width: 1024px) 90vw, 45vw"
                  />
                </div>

                {/* Navigation row */}
                <div className="flex items-center justify-between px-4 py-5 mt-2">
                  <button
                    aria-label="Previous image"
                    onClick={() => setActiveImage((i) => Math.max(0, i - 1))}
                    disabled={activeImage === 0}
                    className="w-[42px] h-[42px] rounded-full bg-white flex items-center justify-center text-black hover:shadow-md disabled:opacity-30 transition-all duration-200"
                  >
                    <ChevronLeftIcon />
                  </button>
                  <span className="font-sans font-normal text-[16px] leading-[24px] text-[#9F9F9F]">
                    {activeImage + 1}/{product.images.length}
                  </span>
                  <button
                    aria-label="Next image"
                    onClick={() => setActiveImage((i) => Math.min(product.images.length - 1, i + 1))}
                    disabled={activeImage === product.images.length - 1}
                    className="w-[42px] h-[42px] rounded-full bg-white flex items-center justify-center text-black hover:shadow-md disabled:opacity-30 transition-all duration-200"
                  >
                    <ChevronRightIcon />
                  </button>
                </div>
              </div>

              {/* Thumbnail strip */}
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    aria-label={`View image ${i + 1}`}
                    onClick={() => setActiveImage(i)}
                    className={`relative w-16 h-16 flex-shrink-0 border-2 bg-white transition-colors duration-200 ${
                      i === activeImage ? "border-black" : "border-[#CFCFCF] hover:border-[#909090]"
                    }`}
                  >
                    <Image src={img} alt="" fill className="object-contain p-1" sizes="64px" />
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Sticky product info */}
            <div className="w-full lg:flex-1 lg:sticky lg:self-start flex flex-col gap-6" style={{ top: "calc(var(--nav-height) + 2rem)" }}>

              {/* Identity: name, subtitle, rating, price */}
              <div className="flex flex-col gap-[7px]">
                <h1 className="font-sans font-medium text-[20px] leading-[30px] text-black">
                  {product.name}
                </h1>
                <p className="font-sans font-normal text-[16px] leading-[24px] text-[#A0A0A0]">
                  {product.description}
                </p>

                {/* Star rating */}
                <div className="flex items-center gap-[2px] mt-1">
                  <span className="font-sans font-normal text-[16px] text-black mr-1">
                    {product.rating}/5
                  </span>
                  {Array.from({ length: 5 }, (_, i) => (
                    <StarIcon key={i} filled={i < Math.round(product.rating)} />
                  ))}
                  <span className="ml-2 font-sans font-normal text-[13px] text-[#909090]">
                    ({product.reviewCount} reviews)
                  </span>
                </div>

                {/* Price row */}
                <div className="flex items-center flex-wrap gap-3 mt-2">
                  <span className="font-sans font-medium text-[24px] leading-[36px] text-black">
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                  <span className="font-sans font-normal text-[20px] leading-[30px] text-[#AAAAAA] line-through">
                    ₹{product.originalPrice.toLocaleString("en-IN")}
                  </span>
                  {/* Promo badge */}
                  <div
                    className="flex items-center px-5 py-1.5 rounded-[24px]"
                    style={{ background: "linear-gradient(90deg, rgba(228,194,60,0.14) 0%, rgba(255,255,255,0) 100%)" }}
                  >
                    <span className="font-sans font-normal text-[14px] leading-[21px] text-black">
                      Get flat ₹500/- off on your first order.
                    </span>
                  </div>
                </div>
                <p className="font-sans font-normal text-[15px] leading-[22px] text-[#BABABA]">
                  Inclusive of all taxes
                </p>
              </div>

              {/* Material spec badges */}
              <div className="flex flex-wrap gap-2">
                {product.specs.map((spec) => (
                  <span
                    key={spec}
                    className="px-3 py-1 border border-[#CFCFCF] rounded-full font-sans font-normal text-[13px] leading-[21px] text-[#626262] bg-white"
                  >
                    {spec}
                  </span>
                ))}
              </div>

              {/* Ring size picker, rings only */}
              {product.type === "ring" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-sans font-medium text-[14px] leading-[21px] text-black">
                      Ring Size{selectedSize ? `: ${selectedSize}` : ""}
                    </span>
                    <button
                      onClick={() => setSizeChartOpen(true)}
                      className="font-sans font-light text-[13px] text-[#626262] underline underline-offset-2 hover:text-black transition-colors duration-200"
                    >
                      Size chart guide
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setSelectedSize(size === selectedSize ? null : size);
                          setSizeRequiredError(false);
                        }}
                        className={`w-10 h-10 border font-sans font-normal text-[14px] rounded transition-colors duration-150 ${
                          selectedSize === size
                            ? "bg-black text-white border-black"
                            : sizeRequiredError
                              ? "bg-white border-[#D93025] text-[#626262] hover:border-black hover:text-black"
                              : "bg-white border-[#CFCFCF] text-[#626262] hover:border-black hover:text-black"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  {sizeRequiredError && (
                    <p role="alert" className="font-sans font-normal text-[13px] text-[#D93025]">
                      Please select a size before you continue.
                    </p>
                  )}
                </div>
              )}

              {/* CTA buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const variantId = resolveVariantId();
                    if (variantId === null) return; // ring with no size picked
                    if (!inCart) {
                      addToCart(product, product.type === "ring" ? selectedSize : null, variantId);
                    }
                    router.push("/checkout");
                  }}
                  className="flex-1 flex items-center justify-center px-4 sm:px-8 py-3 sm:py-[14px] bg-black text-white font-sans font-medium text-[15px] sm:text-[18px] leading-[20px] whitespace-nowrap rounded-full hover:bg-[#1a1a1a] transition-colors duration-200"
                  style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
                >
                  Buy now
                </button>
                <button
                  onClick={() => {
                    if (inCart) return;
                    const variantId = resolveVariantId();
                    if (variantId === null) return; // ring with no size picked
                    addToCart(product, product.type === "ring" ? selectedSize : null, variantId);
                  }}
                  className={`flex-1 flex items-center justify-center px-4 sm:px-8 py-3 sm:py-[14px] font-sans font-medium text-[15px] sm:text-[18px] leading-[20px] whitespace-nowrap rounded-full border transition-colors duration-200 ${
                    inCart
                      ? "bg-black text-white border-black"
                      : "bg-white text-black border-[#DBDBDB] hover:border-black"
                  }`}
                  style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
                >
                  {inCart ? "Added to cart" : "Add to cart"}
                </button>
              </div>

              {/* Service badges */}
              <div className="flex border border-[#C5C5C5] rounded-[20px] overflow-hidden">
                {serviceItems.map((item, i) => (
                  <div
                    key={item.label}
                    className={`flex-1 flex flex-col items-center gap-[5px] py-3 ${
                      i < serviceItems.length - 1 ? "border-r border-[#C5C5C5]" : ""
                    }`}
                  >
                    {item.icon}
                    <span className="font-sans font-normal text-[12px] leading-[18px] text-[#696969] text-center">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pincode delivery checker */}
              <div className="flex flex-col gap-[6px]">
                <p className="font-sans font-normal text-[15px] leading-[22px] text-black">
                  Estimated Delivery Time
                </p>
                <div className="flex items-center border border-[#E1E1E1] rounded-[333px] overflow-hidden bg-white">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter Pincode"
                    value={pincode}
                    onChange={(e) => {
                      setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      pincodeCheck.reset();
                    }}
                    className="flex-1 px-[18px] py-[12px] font-sans font-normal text-[16px] text-black placeholder:text-[#909090] bg-transparent outline-none"
                  />
                  <button
                    onClick={() => pincodeCheck.check(pincode)}
                    disabled={pincodeCheck.status === "loading"}
                    className="px-6 py-[12px] bg-black text-white font-sans font-normal text-[16px] rounded-[100px] hover:bg-[#1a1a1a] disabled:opacity-60 transition-colors duration-200 mr-px"
                    style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
                  >
                    {pincodeCheck.status === "loading" ? "Checking…" : "Check"}
                  </button>
                </div>
                {pincodeCheck.status === "error" && (
                  <p className="font-sans font-normal text-[13px] leading-[20px] text-[#D93025]">
                    {pincodeCheck.error}
                  </p>
                )}
                {pincodeCheck.status === "success" && pincodeCheck.result && (
                  <p className="font-sans font-normal text-[13px] leading-[20px] text-[#626262]">
                    {pincodeCheck.result.serviceable
                      ? `Delivery available! Arriving ${formatDeliveryRange(pincodeCheck.result.estimatedDays, pincodeCheck.result.estimatedDays + 1)}${pincodeCheck.result.availablePaymentMethods.includes("cod") ? ", cash on delivery available" : ", prepaid only"}.`
                      : "Sorry, we don't currently deliver to this pincode."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Size chart modal ──────────────────────── */}
      {sizeChartOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setSizeChartOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ring size guide"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white max-w-md w-full max-h-[85vh] overflow-y-auto rounded-2xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-sans font-medium text-[18px] text-black">Ring Size Guide</h2>
                <button
                  aria-label="Close size chart"
                  onClick={() => setSizeChartOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F7F7F7] text-[#626262] hover:text-black transition-colors duration-200"
                >
                  <XIcon />
                </button>
              </div>

              <p className="font-sans font-normal text-[13px] leading-relaxed text-[#626262] mb-6">
                Wrap a soft tape or a strip of paper around your finger and mark where it overlaps.
                Measure the length in mm and match it below.
              </p>

              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#F7F7F7]">
                    <th className="border border-[#CFCFCF] p-3 text-left font-medium text-black">Size (India)</th>
                    <th className="border border-[#CFCFCF] p-3 text-left font-medium text-black">Circ. (mm)</th>
                    <th className="border border-[#CFCFCF] p-3 text-left font-medium text-black">Dia. (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZE_CHART.map((row, i) => (
                    <tr
                      key={row.size}
                      className={
                        selectedSize === row.size
                          ? "bg-[rgba(228,194,60,0.1)]"
                          : i % 2 === 0
                          ? "bg-white"
                          : "bg-[#FAFAFA]"
                      }
                    >
                      <td className={`border border-[#CFCFCF] p-3 ${selectedSize === row.size ? "font-medium text-black" : "text-[#626262]"}`}>
                        {row.size}
                        {selectedSize === row.size && (
                          <span className="ml-2 text-[11px] text-[#9F7A00]">← selected</span>
                        )}
                      </td>
                      <td className="border border-[#CFCFCF] p-3 text-[#626262]">{row.circumference}</td>
                      <td className="border border-[#CFCFCF] p-3 text-[#626262]">{row.diameter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                className="mt-6 w-full flex items-center justify-center py-[14px] bg-black text-white font-sans font-medium text-[16px] rounded-full hover:bg-[#1a1a1a] transition-colors duration-200"
                onClick={() => setSizeChartOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

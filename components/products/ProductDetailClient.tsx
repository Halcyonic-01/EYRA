"use client";

import { percentOff as discountPercent } from "@/lib/discount";
import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { DetailProduct } from "@/lib/products";
import { useCartStore, useWishlistStore } from "@/store/useStore";
import { SIZE_CHART } from "@/lib/sizing";
import { usePincodeServiceability } from "@/lib/hooks/usePincodeServiceability";
import { formatDeliveryRange } from "@/lib/delivery-date";
import { choiceOptions, defaultSelection, isInCart, resolveVariant, type Selection, sameSize, sizeOptions } from "@/lib/variant-selection";
import { COD_CHARGE, rupees } from "@/config/offers";
import { PolicyBadge } from "@/components/products/PolicyBadge";
import { ProductOffers } from "@/components/offers/ProductOffers";

/** The anklet option: one anklet, or a pair of the same design (see the backend's anklet-pair sync). */
const PACK = "Pack";
const SINGLE = "Single";
const PAIR = "Pair";

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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#696969" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function ExchangeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#696969" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M7 16H3v-4" /><path d="M3 12a9 9 0 0 1 14.12-7.37" />
      <path d="M17 8h4v4" /><path d="M21 12a9 9 0 0 1-14.12 7.37" />
    </svg>
  );
}

function CodIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#696969" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M6 3h12" /><path d="M6 8h8" /><path d="M6 13l8.5 8" />
      <path d="M6 13h3a4 4 0 0 0 0-8" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#545454" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#545454" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
      <path d="M19 17l.7 1.8L21.5 19.5l-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7L19 17z" />
    </svg>
  );
}

function DropIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#545454" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5s-6.5 7.2-6.5 12a6.5 6.5 0 0 0 13 0c0-4.8-6.5-12-6.5-12z" />
    </svg>
  );
}

/** Quality promises shown as a vertical stack at the bottom of the product details. */
const QUALITY_BADGES: readonly { icon: React.ReactNode; title: string; description: string }[] = [
  {
    icon: <ShieldIcon />,
    title: "925 Sterling Silver & Hallmarked",
    description: "Crafted with genuine 925 silver, certified for unmatched purity and quality.",
  },
  {
    icon: <SparkleIcon />,
    title: "Advanced Anti-Tarnish Coating",
    description: "Treated to resist daily wear, sweat, and tarnishing so your jewelry stays brilliant.",
  },
  {
    icon: <DropIcon />,
    title: "Waterproof & Hypoallergenic",
    description: "Safe for sensitive skin and completely water-resistant for everyday effortless wear.",
  },
];

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
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
  // A size as written in Medusa ("7", "7.5", "S"). A product with only one size has it picked already.
  const [pickedSize, setSelectedSize] = useState<string | null>(() =>
    product.sizes.length === 1 ? product.sizes[0] : null
  );
  const [sizeRequiredError, setSizeRequiredError] = useState(false);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [pincode, setPincode] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const pincodeCheck = usePincodeServiceability();
  const touchStartX = useRef<number>(0);

  // While the full-screen view is open: lock page scroll, and let the keyboard
  // close it or move between images.
  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") setActiveImage((i) => Math.min(product.images.length - 1, i + 1));
      if (e.key === "ArrowLeft") setActiveImage((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxOpen, product.images.length]);

  const addToCart = useCartStore((s) => s.addToCart);
  const cartItems = useCartStore((s) => s.items);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const wishlist = useWishlistStore((s) => s.items.some((i) => i.product.id === product.id));
  // Choices besides ring size (single or pair, with or without a chain). The
  // page opens on the cheapest option; Medusa's own variant prices decide the rest.
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const choices = useMemo(() => product.choices ?? [], [product.choices]);
  const [selection, setSelection] = useState<Selection>(() => defaultSelection(variants, choices));

  // Any product with a Size option (a ring, or a sized bracelet) needs one picked.
  const hasSizes = product.sizes.length > 0;
  const sizeLabel = product.type === "ring" ? "Ring Size" : product.sizeOptionTitle ?? "Size";
  // Each size and whether it is in stock, given the other choices.
  const sizeOpts = useMemo(
    () => sizeOptions(variants, product.sizes, selection, product.sizeOptionTitle),
    [variants, product.sizes, selection, product.sizeOptionTitle]
  );
  // A picked size that is sold out under the other choices (a pair, say) counts as not picked.
  const selectedSize =
    pickedSize !== null && sizeOpts.some((o) => o.value === pickedSize && o.inStock) ? pickedSize : null;
  const resolved = useMemo(
    () => resolveVariant(variants, selection, product.sizeOptionTitle, hasSizes ? selectedSize : null),
    [variants, selection, product.sizeOptionTitle, hasSizes, selectedSize]
  );
  // The variant to sell. Products Medusa has no variant list for (mock data)
  // fall back to the product's own variant.
  const variantId = variants.length > 0 ? resolved.variant?.id : product.variantId;
  // Stock left for the variant being sold. Null while no variant is picked yet
  // (a ring with no size), so the stepper is not capped by a guess.
  const maxQuantity: number | null = variants.length > 0 ? resolved.variant?.inStock ?? null : product.inStock;
  // The quantity actually sold: the chosen amount, never more than the stock left.
  const sellQuantity = maxQuantity === null ? quantity : Math.min(quantity, Math.max(1, maxQuantity));
  const atMaxQuantity = maxQuantity !== null && sellQuantity >= maxQuantity;
  const unitPrice = variants.length > 0 ? resolved.price : product.price;
  const unitOriginal = variants.length > 0 ? resolved.originalPrice : product.originalPrice;
  // Anklets come as a Single or a Pair of the same design, and the quantity
  // counts the chosen option: 2 Pairs are 4 anklets at two pair prices. Their
  // price is shown for the whole quantity; other products show one piece.
  const ankletPacks = product.type === "anklet" && choices.some((choice) => choice.title === PACK);
  const isPairPack = ankletPacks && selection[PACK] === PAIR;
  const singleUnit = variants.find((v) => v.options[PACK] === SINGLE)?.price ?? null;
  const shownPrice = ankletPacks ? unitPrice * sellQuantity : unitPrice;
  const shownOriginal = ankletPacks ? unitOriginal * sellQuantity : unitOriginal;
  const percentOff = discountPercent(shownPrice, shownOriginal);
  const pairSavingTotal = isPairPack && singleUnit !== null ? Math.max(0, singleUnit * 2 - unitPrice) * sellQuantity : 0;
  const inCart = isInCart(cartItems, variantId) ||
    (variants.length === 0 &&
      cartItems.some((i) => i.product.id === product.id && sameSize(i.size, hasSizes ? selectedSize : null)));

  /**
   * Resolves which variant an add-to-cart/buy-now action should use.
   *
   * A ring with no size picked has no single variant, and guessing one used to
   * hand customers whatever size Medusa listed first. Returns null and flags
   * the size picker instead of guessing.
   */
  function resolveVariantId(): string | undefined | null {
    if (hasSizes && !selectedSize) {
      setSizeRequiredError(true);
      return null;
    }
    return variantId;
  }

  /**
   * The share control rendered but had no click handler at all, so tapping it
   * did nothing. Native share sheet where the browser offers one (every mobile
   * browser, which is where sharing a product actually happens), clipboard
   * copy everywhere else.
   */
  async function handleShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, text: product.description, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied");
    } catch (err) {
      // A user dismissing the share sheet rejects with AbortError. That is a
      // deliberate cancel, not a failure worth telling them about.
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[EYRA/share] Could not share product link:", err);
      setShareNote("Could not copy link");
    }
    window.setTimeout(() => setShareNote(""), 2000);
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
    { icon: <CodIcon />, label: `Cash On Delivery (+${rupees(COD_CHARGE)})` },
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
                <div className="flex items-start justify-end px-[18px] pt-5">
                  <div className="flex gap-1 items-start">
                    {shareNote && (
                      <span
                        role="status"
                        className="self-center mr-1 px-2 py-1 rounded-full bg-black/80 text-white font-sans font-normal text-[11px] whitespace-nowrap"
                      >
                        {shareNote}
                      </span>
                    )}
                    <button
                      aria-label="Share"
                      onClick={handleShare}
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
                        const wishlistVariantId =
                          hasSizes && !selectedSize ? undefined : variantId;
                        // Save the size alongside the variant so moving this
                        // to the cart later can label the line with it.
                        toggleWishlist(
                          product,
                          wishlistVariantId,
                          hasSizes ? selectedSize : null
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
                  role="button"
                  tabIndex={0}
                  aria-label="View image full screen"
                  className="relative flex-1 mx-2.5 mt-4 mb-0 cursor-zoom-in select-none"
                  style={{ minHeight: 280 }}
                  onClick={() => setLightboxOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setLightboxOpen(true);
                  }}
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
            <div className="w-full lg:flex-1 lg:sticky lg:self-start flex flex-col gap-6" style={{ top: "calc(var(--header-offset) + 2rem)" }}>

              {/* Identity: name, subtitle, rating, price */}
              <div className="flex flex-col gap-[7px]">
                <h1 className="font-sans font-medium text-[20px] leading-[30px] text-black">
                  {product.name}
                </h1>
                {product.description && (
                  <p className="font-sans font-normal text-sm text-gray-600 leading-relaxed">
                    {product.description}
                  </p>
                )}

                {/* Star rating: only once there are reviews to show */}
                {product.reviewCount > 0 && (
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
                )}

                {/* Price row: current price bold, MRP muted beside it */}
                <div className="flex items-baseline flex-wrap gap-3 mt-2">
                  <span className="font-sans font-medium text-[24px] leading-[36px] text-black">
                    ₹{shownPrice.toLocaleString("en-IN")}
                  </span>
                  <span className="font-sans font-normal text-[18px] leading-[28px] text-[#A3A3A3] line-through">
                    ₹{shownOriginal.toLocaleString("en-IN")}
                  </span>
                  {percentOff > 0 && (
                    <span className="self-center rounded-md bg-[#E3F6E8] px-2 py-0.5 font-sans text-[13px] font-medium leading-[20px] text-[#1E7A3C]">
                      {percentOff}% off
                    </span>
                  )}
                </div>
                {ankletPacks && (isPairPack || sellQuantity > 1) && (
                  <p className="font-sans font-medium text-[14px] leading-[21px] text-black">
                    {isPairPack
                      ? `${sellQuantity} ${sellQuantity === 1 ? "pair" : "pairs"} · ${sellQuantity * 2} anklets`
                      : `${sellQuantity} anklets`}
                    {pairSavingTotal > 0 && ` · You save ₹${pairSavingTotal.toLocaleString("en-IN")}`}
                  </p>
                )}
                <p className="font-sans font-normal text-[15px] leading-[22px] text-[#BABABA]">
                  Inclusive of all taxes
                </p>
              </div>

              {/* Choices besides ring size: single or pair, with or without a chain */}
              {choices.map((choice) => {
                const options = choiceOptions(
                  variants,
                  choice,
                  selection,
                  product.sizeOptionTitle,
                  hasSizes ? selectedSize : null
                );
                // A pair of anklets is priced below two singles; say how much below.
                const single = options.find((o) => o.value === SINGLE && o.inStock);
                const pairSaving = (price: number, value: string) =>
                  value === PAIR && single ? single.price * 2 - price : 0;
                // Single/Pair buttons carry only the name; the price and saving show above.
                const namesOnly = choice.title === PACK;
                return (
                  <div key={choice.title} className="flex flex-col gap-3">
                    <span className="font-sans font-medium text-[14px] leading-[21px] text-black">
                      {choice.title}
                      {selection[choice.title] ? `: ${selection[choice.title]}` : ""}
                    </span>
                    <div
                      className={options.length === 2 ? "grid grid-cols-2 gap-3" : "flex flex-wrap gap-2"}
                      role="radiogroup"
                      aria-label={choice.title}
                    >
                      {options.map((option) => {
                        const active = selection[choice.title] === option.value;
                        const saving = option.inStock ? pairSaving(option.price, option.value) : 0;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={!option.inStock}
                            onClick={() => setSelection((prev) => ({ ...prev, [choice.title]: option.value }))}
                            className={`flex flex-col items-center justify-center gap-px rounded-lg border px-3 py-1.5 text-center font-sans transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
                              active
                                ? "border-black bg-[#EDEDED] text-black shadow-[inset_0_0_0_1px_#000]"
                                : "border-[#CFCFCF] bg-white text-[#626262] hover:border-black hover:text-black"
                            }`}
                          >
                            <span className={`font-semibold tracking-[0.02em] ${namesOnly ? "text-[14px] leading-[24px]" : "text-[13px] leading-[18px]"}`}>
                              {option.value}
                            </span>
                            {(!namesOnly || !option.inStock) && (
                            <span
                              className={`whitespace-nowrap text-[12px] font-normal leading-[16px] tabular-nums tracking-[0.01em] ${
                                active ? "text-[#3D3D3D]" : "text-[#7A7A7A]"
                              }`}
                            >
                              {option.inStock ? `₹${option.price.toLocaleString("en-IN")}` : "Sold out"}
                              {!namesOnly && saving > 0 && ` · Save ₹${saving.toLocaleString("en-IN")}`}
                            </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Size picker: rings, and any other product with a Size option */}
              {hasSizes && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-sans font-medium text-[14px] leading-[21px] text-black">
                      {sizeLabel}{selectedSize ? `: ${selectedSize}` : ""}
                    </span>
                    {product.type === "ring" && (
                      <button
                        onClick={() => setSizeChartOpen(true)}
                        className="font-sans font-light text-[13px] text-[#626262] underline underline-offset-2 hover:text-black transition-colors duration-200"
                      >
                        Size chart guide
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={sizeLabel}>
                    {sizeOpts.map(({ value: size, inStock }) => {
                      const active = selectedSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={inStock ? `${sizeLabel} ${size}` : `${sizeLabel} ${size}, sold out`}
                          title={inStock ? undefined : "Sold out"}
                          disabled={!inStock}
                          onClick={() => {
                            setSelectedSize(active ? null : size);
                            setSizeRequiredError(false);
                          }}
                          className={`min-w-[44px] h-11 px-3 rounded-full border font-sans text-[14px] tabular-nums transition-colors duration-150 disabled:cursor-not-allowed disabled:border-[#E6E6E6] disabled:bg-[#F7F7F7] disabled:text-[#B5B5B5] disabled:line-through ${
                            active
                              ? "border-black bg-black text-white"
                              : sizeRequiredError
                                ? "border-[#D93025] bg-white text-[#626262] hover:border-black hover:text-black"
                                : "border-[#D4D4D4] bg-white text-[#3A3A3A] hover:border-black hover:text-black"
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                  {sizeOpts.some((o) => !o.inStock) && (
                    <p className="font-sans font-normal text-[12px] text-[#909090]">Crossed-out sizes are sold out.</p>
                  )}
                  {sizeRequiredError && (
                    <p role="alert" className="font-sans font-normal text-[13px] text-[#D93025]">
                      Please select a size before you continue.
                    </p>
                  )}
                </div>
              )}

              {/* Quantity stepper */}
              <div className="flex flex-col gap-3">
                <span className="font-sans font-medium text-[14px] leading-[21px] text-black">Quantity</span>
                <div className="flex items-center self-start rounded-full border border-[#D4D4D4] bg-white overflow-hidden">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity(Math.max(1, sellQuantity - 1))}
                    disabled={sellQuantity <= 1}
                    className="w-11 h-11 flex items-center justify-center text-black hover:bg-[#F7F7F7] disabled:opacity-30 disabled:hover:bg-white transition-colors duration-150"
                  >
                    <MinusIcon />
                  </button>
                  <span className="min-w-[44px] text-center font-sans font-medium text-[15px] tabular-nums text-black" aria-live="polite">
                    {sellQuantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity(maxQuantity === null ? sellQuantity + 1 : Math.min(sellQuantity + 1, maxQuantity))}
                    disabled={atMaxQuantity}
                    className="w-11 h-11 flex items-center justify-center text-black hover:bg-[#F7F7F7] disabled:opacity-30 disabled:hover:bg-white transition-colors duration-150"
                  >
                    <PlusIcon />
                  </button>
                </div>
                {maxQuantity !== null && maxQuantity <= 5 && (
                  <p className="font-sans font-normal text-[12px] text-[#909090]">
                    {maxQuantity === 0
                      ? "Sold out"
                      : isPairPack
                        ? `Only ${maxQuantity} ${maxQuantity === 1 ? "pair" : "pairs"} left in stock`
                        : `Only ${maxQuantity} left in stock`}
                  </p>
                )}
              </div>

              {/* CTA buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const chosen = resolveVariantId();
                    if (chosen === null) return; // no size picked yet
                    if (!inCart) {
                      addToCart(product, hasSizes ? selectedSize : null, chosen, sellQuantity);
                    }
                    router.push("/checkout");
                  }}
                  className="flex-1 flex items-center justify-center px-6 sm:px-8 py-4 bg-black text-white font-sans font-medium text-[15px] tracking-wide leading-[20px] whitespace-nowrap rounded-full hover:bg-[#1a1a1a] transition-colors duration-200"
                  style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
                >
                  Buy now
                </button>
                <button
                  onClick={() => {
                    if (inCart) return;
                    const chosen = resolveVariantId();
                    if (chosen === null) return; // no size picked yet
                    addToCart(product, hasSizes ? selectedSize : null, chosen, sellQuantity);
                  }}
                  className={`flex-1 flex items-center justify-center px-6 sm:px-8 py-4 font-sans font-medium text-[15px] tracking-wide leading-[20px] whitespace-nowrap rounded-full border transition-colors duration-200 ${
                    inCart
                      ? "bg-black text-white border-black"
                      : "bg-white text-black border-[#DBDBDB] hover:border-black"
                  }`}
                  style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
                >
                  {inCart ? "Added to cart" : "Add to cart"}
                </button>
              </div>

              <PolicyBadge />

              {/* Policies, as a quiet list under the actions */}
              <ul className="flex flex-col gap-3 pt-1">
                {serviceItems.map((item) => (
                  <li key={item.label} className="flex items-center gap-3 font-sans font-normal text-[14px] leading-[21px] text-[#505050]">
                    {item.icon}
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>

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

              {/* Offers that this piece qualifies for, below delivery */}
              <ProductOffers subtotal={shownPrice} context="product" />

              {/* Quality badges: bottom of the product details, below delivery */}
              <div className="flex flex-col gap-4 pt-6 border-t border-[#E1E1E1]">
                {QUALITY_BADGES.map((badge) => (
                  <div key={badge.title} className="flex items-start gap-3">
                    <span className="shrink-0 mt-0.5">{badge.icon}</span>
                    <div className="flex flex-col gap-1">
                      <p className="font-sans font-medium text-sm text-black">{badge.title}</p>
                      <p className="font-sans font-normal text-xs text-gray-500 leading-relaxed">{badge.description}</p>
                    </div>
                  </div>
                ))}
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
                        selectedSize === String(row.size)
                          ? "bg-[rgba(228,194,60,0.1)]"
                          : i % 2 === 0
                          ? "bg-white"
                          : "bg-[#FAFAFA]"
                      }
                    >
                      <td className={`border border-[#CFCFCF] p-3 ${selectedSize === String(row.size) ? "font-medium text-black" : "text-[#626262]"}`}>
                        {row.size}
                        {selectedSize === String(row.size) && (
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

      {/* ── Full-screen image view (tap the main image) ── */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} images`}
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between px-5 py-4 text-white">
            <span className="font-sans font-normal text-[16px] leading-[24px]">
              {activeImage + 1}/{product.images.length}
            </span>
            <button
              aria-label="Close full screen"
              onClick={() => setLightboxOpen(false)}
              className="w-[42px] h-[42px] rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="relative flex-1 mx-4 mb-4">
            <Image
              src={product.images[activeImage]}
              alt={`${product.name}, view ${activeImage + 1}`}
              fill
              className="object-contain"
              sizes="100vw"
            />
            {/* Arrows for desktop. On touch screens, swipe instead. */}
            <button
              aria-label="Previous image"
              onClick={() => setActiveImage((i) => Math.max(0, i - 1))}
              disabled={activeImage === 0}
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-[42px] h-[42px] rounded-full bg-white/10 items-center justify-center text-white hover:bg-white/20 disabled:opacity-30 transition-colors duration-200"
            >
              <ChevronLeftIcon />
            </button>
            <button
              aria-label="Next image"
              onClick={() => setActiveImage((i) => Math.min(product.images.length - 1, i + 1))}
              disabled={activeImage === product.images.length - 1}
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-[42px] h-[42px] rounded-full bg-white/10 items-center justify-center text-white hover:bg-white/20 disabled:opacity-30 transition-colors duration-200"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

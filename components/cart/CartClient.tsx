"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { lineKey, useCartStore, useWishlistStore } from "@/store/useStore";
import { COD_CHARGE, rupees } from "@/config/offers";
import { ToteLine, ToteOffer } from "@/components/offers/ToteOffer";
import { PromoCodeBox } from "@/components/cart/PromoCodeBox";

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DE2E2E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function CartClient() {
  const items = useCartStore((s) => s.items);
  const serverTotals = useCartStore((s) => s.serverTotals);
  const syncStatus = useCartStore((s) => s.syncStatus);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const wishlistItems = useWishlistStore((s) => s.items);

  function moveToWishlist(item: (typeof items)[number]) {
    // toggle() un-hearts an existing entry, so only add when it isn't there yet.
    if (!wishlistItems.some((w) => w.product.id === item.product.id)) {
      toggleWishlist(item.product, item.variantId, item.size);
    }
    removeFromCart(lineKey(item));
  }

  // Units, not cart lines. The checkout sidebar counts the same way, so a cart
  // holding one product at quantity 3 no longer says "1 item" here and
  // "3 items" on the very next screen.
  const totalQty = items.reduce((n, i) => n + i.quantity, 0);

  // Server-authoritative totals, fall back to a client-side subtotal estimate
  // only when the Medusa cart hasn't synced yet (no variantIds or pending sync).
  const totals = useMemo(() => {
    if (serverTotals) {
      return {
        subtotal: serverTotals.subtotal,
        discount: serverTotals.discountTotal,
        delivery: serverTotals.shippingTotal,
        tax: serverTotals.taxTotal,
        // What a prepaid order costs: the items less any discount. Cash on
        // Delivery adds its own charge at checkout, so it is not in this number.
        total: serverTotals.subtotal - serverTotals.discountTotal,
        isEstimate: false,
      };
    }
    const clientSubtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    return {
      subtotal: clientSubtotal,
      discount: 0,
      delivery: 0,
      tax: 0,
      total: clientSubtotal,
      isEstimate: true,
    };
  }, [serverTotals, items]);

  if (items.length === 0) {
    return (
      <div className="max-w-screen-xl mx-auto px-6 lg:px-10 py-24 flex flex-col items-center gap-6">
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#CFCFCF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        <p className="font-sans font-normal text-[20px] text-[#909090]">Your cart is empty</p>
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
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left: Cart items */}
        <div className="flex-1 min-w-0">
          {/* There used to be a "Select all" control and a checkbox per item
              here. Nothing read that selection: the totals below, and the
              Medusa cart that checkout actually charges, were always the full
              items list. Worse, the checked set was seeded from `items` in a
              useState initializer, which runs before the persisted cart has
              rehydrated, so every item rendered unchecked on arrival while
              still being billed for. A control that cannot change what you pay
              is worse than no control, so it is gone; per-item removal is what
              the trash button already does. */}
          <div className="flex items-center justify-between mb-5">
            <h1 className="font-sans font-medium text-[18px] leading-[27px] text-black">
              Shopping cart
            </h1>
            <span className="font-sans font-normal text-[14px] text-[#626262]">
              {totalQty} {totalQty === 1 ? "item" : "items"}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {items.map((item) => {
              const key = lineKey(item);
              const discountPct =
                item.originalUnitPrice > item.unitPrice
                  ? Math.round(((item.originalUnitPrice - item.unitPrice) / item.originalUnitPrice) * 100)
                  : 0;

              return (
                // Below sm: the image+info+qty-stepper+remove row's
                // fixed-width elements alone need ~230px, more than fits
                // beside a readable info column at a 375px viewport, so the
                // qty-stepper/remove group drops to its own row underneath
                // instead of squeezing beside the product info.
                <div key={key} className="flex flex-col sm:flex-row gap-3 sm:gap-4 p-4 bg-white border border-[#E1E1E1] rounded-2xl">
                  <div className="flex gap-4 flex-1 min-w-0">
                    {/* Product image */}
                    <div
                      className="relative w-[79px] h-[79px] flex-shrink-0 rounded-2xl overflow-hidden bg-[#F9F9F9]"
                      style={{ border: "1px solid #E1E1E1", boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }}
                    >
                      <Image
                        src={item.product.images[0]}
                        alt={item.product.name}
                        fill
                        className="object-contain p-2"
                        sizes="79px"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <p className="font-sans font-normal text-[18px] leading-[27px] text-black truncate">
                        {item.product.name}
                      </p>
                      {item.size && (
                        <p className="font-sans font-normal text-[13px] text-[#909090]">Size: {item.size}</p>
                      )}
                      {item.variantLabel && (
                        <p className="font-sans font-normal text-[13px] text-[#909090]">{item.variantLabel}</p>
                      )}

                      {/* Price row */}
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="font-sans font-semibold text-[18px] leading-[27px] text-black">
                          ₹{item.unitPrice.toLocaleString("en-IN")}
                        </span>
                        {discountPct > 0 && (
                          <span className="font-sans font-normal text-[15px] text-[#AAAAAA] line-through">
                            ₹{item.originalUnitPrice.toLocaleString("en-IN")}
                          </span>
                        )}
                        {discountPct > 0 && (
                          <span className="font-sans font-normal text-[13px] text-black">
                            {discountPct}% OFF
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Qty stepper + remove. DOM order matches the original
                      desktop layout (remove above, stepper below via
                      justify-between); order-last on mobile just moves remove
                      to the trailing end of the row instead, a more familiar
                      placement for a destructive action than leading it. */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-end sm:justify-between gap-3 sm:gap-2 flex-shrink-0">
                    <button
                      aria-label="Remove item"
                      onClick={() => removeFromCart(key)}
                      className="order-last sm:order-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#FFF0F0] transition-colors duration-200"
                    >
                      <TrashIcon />
                    </button>

                    {/* Qty stepper */}
                    <div className="flex items-center border border-[#CFCFCF] rounded-lg overflow-hidden">
                      <button
                        aria-label="Decrease quantity"
                        onClick={() => updateQuantity(key, item.quantity - 1)}
                        className="w-[26px] h-[26px] flex items-center justify-center text-black hover:bg-[#F7F7F7] transition-colors duration-150"
                      >
                        <MinusIcon />
                      </button>
                      <span className="w-8 text-center font-sans font-medium text-[18px] leading-none text-black select-none">
                        {item.quantity}
                      </span>
                      <button
                        aria-label="Increase quantity"
                        onClick={() => updateQuantity(key, item.quantity + 1)}
                        className="w-[26px] h-[26px] flex items-center justify-center text-black hover:bg-[#F7F7F7] transition-colors duration-150"
                      >
                        <PlusIcon />
                      </button>
                    </div>

                    <button
                      onClick={() => moveToWishlist(item)}
                      className="order-first sm:order-none flex items-center gap-1.5 font-sans font-normal text-[13px] text-[#626262] hover:text-black transition-colors duration-200"
                    >
                      <HeartIcon />
                      Move to wishlist
                    </button>
                  </div>
                </div>
              );
            })}

          </div>

          {serverTotals?.tote.inCart && <ToteLine className="mt-4 rounded-xl bg-[#F7F7F7] px-4 py-3" />}
          {!totals.isEstimate && (
            <ToteOffer itemsSubtotal={totals.subtotal} inCart={Boolean(serverTotals?.tote.inCart)} className="mt-4" />
          )}
        </div>

        {/* Right: Order Summary */}
        <div
          className="w-full lg:w-[380px] flex-shrink-0 rounded-2xl p-6 flex flex-col gap-4 lg:sticky lg:self-start"
          style={{ background: "#F7F7F7", top: "calc(var(--header-offset) + 2rem)" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-sans font-medium text-[18px] leading-[27px] text-black">
              Order Summary
            </h2>
            {syncStatus === "syncing" && (
              <div className="w-4 h-4 border-2 border-[#AAAAAA] border-t-black rounded-full animate-spin" aria-label="Syncing cart…" />
            )}
          </div>

          <div className="flex flex-col gap-3 text-[14px] font-sans font-normal">
            <div className="flex items-center justify-between">
              <span className="text-[#626262]">
                Subtotal ({totalQty} {totalQty === 1 ? "item" : "items"})
              </span>
              <span className="text-black font-medium">
                ₹{totals.subtotal.toLocaleString("en-IN")}
              </span>
            </div>

            {totals.discount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[#626262]">
                  Discount{serverTotals?.promoCodes[0] ? ` (${serverTotals.promoCodes[0]})` : ""}
                </span>
                <span className="text-black">− ₹{totals.discount.toLocaleString("en-IN")}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[#626262]">Delivery</span>
              {totals.isEstimate ? (
                <span className="text-black">-</span>
              ) : (
                <span className="font-medium" style={{ color: "#47B10A" }}>
                  Free on prepaid orders
                </span>
              )}
            </div>
            {!totals.isEstimate && (
              <p className="font-sans text-[12px] text-[#909090] -mt-1">
                Cash on Delivery adds {rupees(COD_CHARGE)}. You choose at checkout.
              </p>
            )}
          </div>

          {totals.isEstimate && (
            <p className="font-sans text-[11px] text-[#909090]">
              Delivery calculated at checkout.
            </p>
          )}

          <PromoCodeBox />

          <div className="w-full h-px bg-[#DFDFDF]" />

          <div className="flex items-center justify-between">
            <span className="font-sans font-semibold text-[16px] text-black">
              {totals.isEstimate ? "Estimated Total" : "TOTAL"}
            </span>
            <span className="font-sans font-semibold text-[18px] text-black">
              ₹{totals.total.toLocaleString("en-IN")}
            </span>
          </div>
          <p className="font-sans text-[12px] text-[#909090] -mt-2 text-right">
            Inclusive of all taxes
          </p>

          <Link
            href="/checkout"
            className={`w-full flex items-center justify-center py-[14px] bg-black text-white font-sans font-medium text-[18px] rounded-full hover:bg-[#1a1a1a] transition-colors duration-200 ${
              items.length === 0 ? "pointer-events-none opacity-40" : ""
            }`}
            style={{ boxShadow: "inset 0px 6px 10px rgba(211,211,211,0.3)" }}
          >
            Proceed to pay
          </Link>

          <div className="text-center">
            <Link
              href="/refund-policy"
              className="font-sans font-normal text-[13px] text-[#626262] underline underline-offset-2 hover:text-black transition-colors duration-200"
            >
              View refund policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

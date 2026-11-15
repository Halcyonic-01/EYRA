"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, Lock, Minus, Plus, Tag, X, Check, ShoppingBag } from "lucide-react";
import type { Product } from "@/components/products/types";
import { TOTE_MIN_SUBTOTAL, qualifiesForTote, rupees, toteShortfall } from "@/config/offers";
import { useCartTotals } from "@/lib/cart-totals";
import { percentOff } from "@/lib/discount";
import { drawerAllowedOn, useCartDrawer } from "@/store/useCartDrawer";
import { lineKey, useCartStore, type CartItem } from "@/store/useStore";

/**
 * The slide-out bag. It opens over the page when something is added, or from
 * the bag icon, so the shopper keeps their place. A panel on the right on
 * larger screens, a bottom sheet on phones.
 */
export function CartDrawer() {
  const pathname = usePathname();
  const openOn = useCartDrawer((s) => s.openOn);
  const close = useCartDrawer((s) => s.close);
  const isOpen = openOn === pathname && drawerAllowedOn(pathname);

  const items = useCartStore((s) => s.items);
  const serverTotals = useCartStore((s) => s.serverTotals);
  const totals = useCartTotals();
  const panel = useRef<HTMLDivElement>(null);

  // Escape closes; the page behind does not scroll while the bag is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = before;
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  const code = serverTotals?.promoCodes[0];
  const toteInCart = Boolean(serverTotals?.tote.inCart);

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      <button
        type="button"
        aria-label="Close bag"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 bg-black/40 cursor-default animate-[drawer-fade_200ms_ease-out]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Your bag"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 top-12 flex flex-col rounded-t-3xl bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.2)] outline-none animate-[drawer-up_260ms_cubic-bezier(.2,.8,.2,1)] sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[440px] sm:rounded-none sm:shadow-[-20px_0_60px_rgba(0,0,0,0.18)] sm:animate-[drawer-in_260ms_cubic-bezier(.2,.8,.2,1)]"
      >
        <div className="mx-auto mt-2.5 h-[5px] w-11 rounded-full bg-[#D6D6D6] sm:hidden" aria-hidden="true" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-3 sm:px-7 sm:pt-6">
          <h2 className="font-display text-[28px] font-medium leading-none text-black">
            Your bag
            <span className="ml-2 font-sans text-[13px] font-normal text-[#909090]">
              {totals.quantity} {totals.quantity === 1 ? "piece" : "pieces"}
            </span>
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close bag"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-black transition-colors hover:bg-[#F2F2F2]"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {items.length === 0 ? (
          <EmptyBag onClose={close} />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ToteProgress subtotal={totals.subtotal} inCart={toteInCart} />
              <ul className="px-5 sm:px-7">
                {items.map((item) => (
                  <DrawerLine key={lineKey(item)} item={item} />
                ))}
              </ul>
              <Suggestions inBag={items.map((i) => i.product.id)} />
            </div>

            {/* Footer: always in view */}
            <div className="border-t border-[#E4E4E4] bg-white px-5 pb-6 pt-4 sm:px-7">
              {code && totals.discount > 0 && (
                <div className="mb-3 flex items-center justify-between rounded-xl bg-[#EDF6EF] px-3 py-2.5 font-sans text-[13px] text-black">
                  <span className="flex items-center gap-2">
                    <Tag size={14} strokeWidth={1.75} aria-hidden="true" />
                    {code} applied
                  </span>
                  <span className="font-medium text-[#2F7A4A]">−{rupees(totals.discount)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="font-sans text-[14px] font-medium text-black">
                  {totals.isEstimate ? "Estimated total" : "Total"}
                </span>
                <span className="font-sans text-[22px] font-semibold tabular-nums text-black" data-testid="drawer-total">
                  {rupees(totals.total)}
                </span>
              </div>
              <p className="mt-1 font-sans text-[12px] leading-[18px] text-[#626262]">
                Taxes included. <span className="font-medium text-[#2F7A4A]">Free delivery</span> on prepaid orders.
                {totals.saved > 0 && <> You save {rupees(totals.saved)}.</>}
              </p>
              <Link
                href="/checkout"
                onClick={close}
                className="mt-4 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-black font-sans text-[15px] font-medium text-white transition-colors hover:bg-[#1A1A1A]"
              >
                <Lock size={15} strokeWidth={1.75} aria-hidden="true" />
                Checkout · {rupees(totals.total)}
              </Link>
              <Link
                href="/cart"
                onClick={close}
                className="mt-2.5 hidden h-[46px] w-full items-center justify-center rounded-full border border-[#D0D0D0] font-sans text-[14px] text-black transition-colors hover:border-black sm:flex"
              >
                View full bag
              </Link>
              <ul className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label="Ways to pay">
                {["UPI", "Cards", "Net banking", "Cash on Delivery"].map((way) => (
                  <li key={way} className="rounded-md border border-[#E4E4E4] px-2 py-1 font-sans text-[10.5px] tracking-[0.04em] text-[#4D4D4D]">
                    {way}
                  </li>
                ))}
              </ul>
              <Link
                href="/cart"
                onClick={close}
                className="mt-3 block text-center font-sans text-[13px] text-[#4D4D4D] underline underline-offset-4 sm:hidden"
              >
                View full bag
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyBag({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 pb-16 text-center">
      <ShoppingBag size={44} strokeWidth={1} className="text-[#BCBCBC]" aria-hidden="true" />
      <p className="font-sans text-[16px] text-[#626262]">Your bag is empty</p>
      <Link
        href="/products"
        onClick={onClose}
        className="rounded-full bg-black px-7 py-3 font-sans text-[14px] font-medium text-white hover:bg-[#1A1A1A]"
      >
        Browse products
      </Link>
    </div>
  );
}

/** Progress towards the complimentary tote bag, and a tick once it is in. */
function ToteProgress({ subtotal, inCart }: { subtotal: number; inCart: boolean }) {
  const qualifies = qualifiesForTote(subtotal);
  const progress = qualifies ? 1 : Math.min(1, subtotal / (TOTE_MIN_SUBTOTAL + 1));
  return (
    <div className="mx-5 mb-1 rounded-xl bg-[#F9F9F9] px-4 py-3.5 sm:mx-7" role="status">
      <div className="flex items-center justify-between gap-3 font-sans text-[12.5px] text-black">
        <span className="flex items-center gap-2">
          <Gift size={14} strokeWidth={1.75} aria-hidden="true" />
          {qualifies
            ? "Complimentary tote bag unlocked"
            : `Add ${rupees(toteShortfall(subtotal))} more for a complimentary tote bag`}
        </span>
        {qualifies && <span className="font-medium text-[#2F7A4A]">{inCart ? "Added" : "Unlocked"}</span>}
      </div>
      <div className="relative mt-2.5 h-1 rounded-full bg-[#E6E6E6]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-black transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
        {qualifies && (
          <span className="absolute -right-0.5 top-1/2 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full bg-black text-white">
            <Check size={11} strokeWidth={2.5} aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}

function DrawerLine({ item }: { item: CartItem }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const key = lineKey(item);
  const pct = percentOff(item.unitPrice, item.originalUnitPrice);
  const detail = [item.size !== null && item.size !== undefined ? `Size ${item.size}` : null, item.variantLabel]
    .filter(Boolean)
    .join(" · ");
  const image = item.product.images[0];

  return (
    <li className="grid grid-cols-[76px_1fr_auto] gap-4 border-b border-[#E4E4E4] py-4 sm:grid-cols-[84px_1fr_auto]">
      <Link
        href={`/products/${item.product.id}`}
        aria-hidden="true"
        tabIndex={-1}
        className="relative h-[88px] w-[76px] overflow-hidden rounded-[10px] bg-[#F9F9F9] sm:h-24 sm:w-[84px]"
      >
        {image && <Image src={image} alt="" fill sizes="84px" className="object-contain p-1.5 mix-blend-multiply" />}
      </Link>
      <div className="min-w-0">
        <Link href={`/products/${item.product.id}`} className="block truncate font-sans text-[14px] font-medium text-black hover:underline">
          {item.product.name}
        </Link>
        {detail && <p className="mt-0.5 font-sans text-[12px] text-[#909090]">{detail}</p>}
        <div className="mt-2.5 inline-flex h-[30px] items-center rounded-full border border-[#DADADA]">
          <button
            type="button"
            aria-label={`Decrease quantity of ${item.product.name}`}
            onClick={() => updateQuantity(key, item.quantity - 1)}
            className="flex h-full w-8 items-center justify-center text-black"
          >
            <Minus size={12} strokeWidth={2} />
          </button>
          <span className="w-5 text-center font-sans text-[13px] tabular-nums text-black" aria-live="polite">
            {item.quantity}
          </span>
          <button
            type="button"
            aria-label={`Increase quantity of ${item.product.name}`}
            onClick={() => updateQuantity(key, item.quantity + 1)}
            className="flex h-full w-8 items-center justify-center text-black"
          >
            <Plus size={12} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="flex flex-col items-end justify-between text-right">
        <div className="font-sans tabular-nums">
          <p className="text-[14px] font-medium text-black">{rupees(item.unitPrice * item.quantity)}</p>
          {pct > 0 && (
            <>
              <p className="text-[12px] text-[#A2A2A2] line-through">{rupees(item.originalUnitPrice * item.quantity)}</p>
              <p className="text-[11.5px] font-medium text-[#2F7A4A]">{pct}% off</p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => removeFromCart(key)}
          aria-label={`Remove ${item.product.name}`}
          className="font-sans text-[12px] text-[#626262] underline underline-offset-[3px] hover:text-black"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

/** Two pieces that go with the bag, each a tap away. */
function Suggestions({ inBag }: { inBag: string[] }) {
  const addToCart = useCartStore((s) => s.addToCart);
  const [found, setFound] = useState<{ key: string; products: Product[] } | null>(null);
  const key = [...new Set(inBag)].sort().join(",");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cart/suggestions?inBag=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data: { products?: Product[] }) => setFound({ key, products: data.products ?? [] }))
      .catch(() => {});
    return () => controller.abort();
  }, [key]);

  const products = found?.key === key ? found.products : [];
  if (products.length === 0) return null;

  return (
    <section className="px-5 pb-5 pt-5 sm:px-7" aria-label="Pairs well with">
      <h3 className="mb-3 font-sans text-[11px] font-medium uppercase tracking-[0.22em] text-[#909090]">Pairs well with</h3>
      <ul className="grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2">
        {products.map((product) => {
          const direct = !product.needsChoice && product.variantId;
          return (
            <li key={product.id} className="flex items-center gap-2.5 rounded-xl border border-[#E4E4E4] p-2">
              <Link href={`/products/${product.id}`} aria-hidden="true" tabIndex={-1} className="relative h-[52px] w-[52px] flex-shrink-0 overflow-hidden rounded-lg bg-[#F9F9F9]">
                {product.images[0] && (
                  <Image src={product.images[0]} alt="" fill sizes="52px" className="object-contain p-1 mix-blend-multiply" />
                )}
              </Link>
              <Link href={`/products/${product.id}`} className="min-w-0 flex-1 font-sans text-[12px] leading-[16px] text-black">
                <span className="line-clamp-2">{product.name}</span>
                <span className="block text-[#626262] tabular-nums">
                  {product.hasPriceRange ? "From " : ""}
                  {rupees(product.price)}
                </span>
              </Link>
              {direct ? (
                <button
                  type="button"
                  aria-label={`Add ${product.name} to bag`}
                  onClick={() => addToCart(product, null, product.variantId)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-black text-black transition-colors hover:bg-black hover:text-white"
                >
                  <Plus size={13} strokeWidth={1.75} />
                </button>
              ) : (
                <Link
                  href={`/products/${product.id}`}
                  aria-label={`Choose options for ${product.name}`}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-black text-black transition-colors hover:bg-black hover:text-white"
                >
                  <Plus size={13} strokeWidth={1.75} />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

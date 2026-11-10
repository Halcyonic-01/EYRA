"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Tag } from "lucide-react";
import { AUTOMATIC_BENEFITS, DISCOUNT_OFFERS, rupees } from "@/config/offers";

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Insecure context or permission denied: fall back to a hidden textarea.
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(el);
    }
  }
}

/** How many offers show before the "+N more offers" toggle. */
const VISIBLE_COUNT = 1;

/**
 * The offers that apply to what the customer is looking at. `subtotal` is the
 * price of the items before discount and shipping. On a product page it is that
 * piece's price; in the cart it is the whole bag. Codes are applied per order,
 * so on a product page "unlocked" means this piece alone clears the threshold.
 */
export function ProductOffers({
  subtotal,
  context,
  className = "",
}: {
  subtotal: number;
  context: "product" | "cart";
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listId = useId();

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  async function handleCopy(code: string) {
    if (!(await writeToClipboard(code))) return;
    setCopiedCode(code);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopiedCode(null), 2000);
  }

  const codeCards = DISCOUNT_OFFERS.map((offer) => {
    const unlocked = subtotal > offer.minOrderAbove;
    const shortfall = Math.ceil(offer.minOrderAbove + 1 - subtotal);
    const status = unlocked
      ? context === "cart"
        ? "Copy the code and apply it below"
        : "This piece qualifies"
      : `Add ${rupees(shortfall)} to your order to unlock`;
    return { key: offer.code, code: offer.code, title: offer.title, terms: offer.terms, status, unlocked };
  });

  const benefitCards = AUTOMATIC_BENEFITS.map((benefit) => ({
    key: benefit.title,
    code: null,
    title: benefit.title,
    terms: benefit.terms,
    status: "Applied automatically, no code needed",
    unlocked: true,
  }));

  const all = [...codeCards, ...benefitCards];
  const visible = expanded ? all : all.slice(0, VISIBLE_COUNT);
  const hiddenCount = all.length - VISIBLE_COUNT;

  return (
    <section aria-label="Offers" className={`flex flex-col gap-3 ${className}`}>
      <p className="flex items-center gap-2 font-sans text-[13px] font-medium uppercase tracking-[0.16em] text-jet">
        <Tag aria-hidden="true" strokeWidth={1.25} className="size-4 text-smoke" />
        Offers
      </p>

      <ul id={listId} className="flex flex-col gap-2">
        {visible.map((card) => {
          const copied = card.code !== null && copiedCode === card.code;
          return (
            <li
              key={card.key}
              className="flex items-start gap-3 rounded-2xl border border-cloud bg-white px-4 py-3"
            >
              <Tag
                aria-hidden="true"
                strokeWidth={1.25}
                className="mt-0.5 size-4 shrink-0 text-smoke"
              />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[14px] font-medium text-jet">{card.title}</p>
                <p className="mt-0.5 font-sans text-[12px] leading-snug text-smoke">{card.terms}</p>
                {/* Status and code share one row, so the card's height stays low. */}
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <p className={`font-sans text-[12px] ${card.unlocked ? "text-jet" : "text-smoke"}`}>
                    {card.status}
                  </p>
                  {card.code && (
                    <button
                      type="button"
                      onClick={() => handleCopy(card.code!)}
                      aria-label={copied ? `${card.code} copied` : `Copy code ${card.code}`}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.12em] transition-colors duration-200 ${
                        copied
                          ? "border-jet bg-jet text-white"
                          : "border-cloud text-jet hover:border-jet"
                      }`}
                    >
                      {copied ? (
                        <>
                          Copied <Check aria-hidden="true" className="size-3" />
                        </>
                      ) : (
                        <>
                          {card.code} <Copy aria-hidden="true" className="size-3" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
          className="self-start font-sans text-[12px] uppercase tracking-[0.14em] text-jet underline decoration-cloud underline-offset-4 hover:decoration-jet"
        >
          {expanded ? "Show fewer offers" : `+${hiddenCount} more offers`}
        </button>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {copiedCode ? `${copiedCode} copied to clipboard` : ""}
      </span>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { AUTOMATIC_BENEFITS, DISCOUNT_OFFERS } from "@/config/offers";

const OFFERS = DISCOUNT_OFFERS;

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

/**
 * Collapsible "Available offers" bar. On sm+ it slides down in the page flow;
 * below sm the same panel becomes a bottom sheet with a backdrop.
 */
export function PromoCodeDrawer() {
  const [open, setOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  async function handleCopy(code: string) {
    if (!(await writeToClipboard(code))) return;
    setCopiedCode(code);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopiedCode(null), 2000);
  }

  return (
    <div ref={rootRef} className="relative border-b border-cloud bg-white">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="mx-auto flex w-full max-w-screen-xl flex-wrap items-center justify-center gap-3 px-4 py-2.5 font-sans text-[0.7rem] uppercase tracking-[0.16em] text-jet sm:px-6 sm:text-[0.72rem] sm:tracking-[0.22em] lg:px-16"
      >
        <span className="flex items-center gap-3">
          Available offers &amp; promo codes
          <span className="rounded-full border border-jet px-2 py-0.5 text-[0.62rem] tracking-[0.1em]">
            {OFFERS.length + AUTOMATIC_BENEFITS.length} Offers Available
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Mobile-only backdrop */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 sm:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        id={panelId}
        role="region"
        aria-label="Available offers and promo codes"
        className={`fixed inset-x-0 bottom-0 z-50 grid max-h-[85vh] grid-rows-[1fr] rounded-t-2xl bg-ivory transition-[transform,grid-template-rows,visibility] duration-300 ease-out sm:static sm:z-auto sm:max-h-none sm:translate-y-0 sm:rounded-none ${
          open
            ? "translate-y-0 sm:grid-rows-[1fr]"
            : "invisible translate-y-full sm:grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-y-auto sm:overflow-hidden">
          <ul className="mx-auto grid max-w-screen-xl gap-3 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-16">
            {OFFERS.map((offer) => {
              const copied = copiedCode === offer.code;
              return (
                <li
                  key={offer.code}
                  className="flex flex-col gap-3 border border-cloud bg-white p-4"
                >
                  <span className="w-fit border border-dashed border-jet px-2.5 py-1 font-mono text-[0.8rem] font-bold tracking-[0.12em] text-jet">
                    {offer.code}
                  </span>
                  <div className="flex-1">
                    <p className="font-sans text-[0.9rem] font-medium text-jet">{offer.title}</p>
                    <p className="mt-1 font-sans text-[0.72rem] leading-snug text-smoke">
                      {offer.terms}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(offer.code)}
                    aria-label={copied ? `${offer.code} copied` : `Copy code ${offer.code}`}
                    className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 font-sans text-[0.7rem] font-medium uppercase tracking-[0.14em] transition-colors duration-200 ${
                      copied
                        ? "bg-emerald-700 text-white"
                        : "bg-jet text-white hover:bg-charcoal"
                    }`}
                  >
                    {copied ? (
                      <>
                        Copied! <Check aria-hidden="true" className="size-3.5" />
                      </>
                    ) : (
                      <>
                        Copy code <Copy aria-hidden="true" className="size-3.5" />
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <ul
            aria-label="Applied automatically"
            className="mx-auto grid max-w-screen-xl gap-3 px-4 pb-5 sm:grid-cols-2 sm:px-6 lg:px-16"
          >
            {AUTOMATIC_BENEFITS.map((benefit) => (
              <li key={benefit.title} className="flex flex-col gap-1 border border-cloud bg-white p-4">
                <p className="font-sans text-[0.9rem] font-medium text-jet">{benefit.title}</p>
                <p className="font-sans text-[0.72rem] leading-snug text-smoke">{benefit.terms}</p>
                <p className="mt-1 font-sans text-[0.68rem] uppercase tracking-[0.14em] text-smoke">
                  Applied automatically, no code needed
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {copiedCode ? `${copiedCode} copied to clipboard` : ""}
      </span>
    </div>
  );
}

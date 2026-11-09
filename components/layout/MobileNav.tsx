"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, User, X } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useSignOut } from "@/components/auth/useSignOut";

const PRODUCT_TYPES = [
  { label: "Rings", href: "/collections/rings" },
  { label: "Bracelets", href: "/collections/bracelets" },
  { label: "Pendants", href: "/collections/pendants" },
  { label: "Anklets", href: "/collections/anklets" },
] as const;

const NAV_LINKS = [
  { label: "Shop for her", href: "/collections/for-her" },
  { label: "Shop for him", href: "/collections/for-him" },
  { label: "Collection", href: "/collections" },
  { label: "New Arrival", href: "/new-arrivals" },
  { label: "About and Contact", href: "/about" },
] as const;

/**
 * Slide-out navigation for screens below lg, opened from the hamburger in the
 * header. Closed by the close button, the backdrop, Escape, or following a link.
 * `onClose` must be stable (wrap it in useCallback) because it sits in an effect.
 */
export function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [productsOpen, setProductsOpen] = useState(false);
  const panelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { isLoaded, isSignedIn } = useAuth();
  const signOut = useSignOut();

  // Move focus into the drawer when it opens.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Lock page scroll behind the drawer and close on Escape.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[
          "fixed inset-0 z-[55] bg-black/30 transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      <div
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        aria-hidden={!open}
        className={[
          "fixed inset-y-0 left-0 z-[60] flex w-[min(86vw,22rem)] flex-col bg-ivory shadow-xl",
          "transition-[transform,visibility] duration-300 ease-out lg:hidden",
          open ? "visible translate-x-0" : "invisible -translate-x-full",
        ].join(" ")}
      >
        <div
          className="flex shrink-0 items-center justify-between px-6"
          style={{ height: "var(--bar-height)" }}
        >
          <p className="font-sans text-[0.7rem] tracking-[0.28em] uppercase text-[#5F5F5F]">
            Menu
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="-mr-2.5 p-2.5 text-[#333] hover:text-black transition-colors duration-200"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <nav
          aria-label="Mobile navigation"
          className="flex-1 overflow-y-auto px-6"
        >
          <ul className="border-t border-[#E2E2E2]">
            <li className="border-b border-[#E2E2E2]">
              <button
                type="button"
                onClick={() => setProductsOpen((v) => !v)}
                aria-expanded={productsOpen}
                aria-controls={`${panelId}-products`}
                className="flex w-full items-center justify-between py-4 text-left font-display text-[1.375rem] tracking-[0.02em] text-black"
              >
                Product Type
                <ChevronDown
                  size={18}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={[
                    "transition-transform duration-300",
                    productsOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>
              <ul
                id={`${panelId}-products`}
                hidden={!productsOpen}
                className="pb-4 pl-3"
              >
                {PRODUCT_TYPES.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onClose}
                      className="block py-2.5 font-sans text-[0.95rem] font-light text-[#4D4D4D] hover:text-black transition-colors duration-200"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>

            {NAV_LINKS.map(({ label, href }) => (
              <li key={href} className="border-b border-[#E2E2E2]">
                <Link
                  href={href}
                  onClick={onClose}
                  className="flex items-center py-4 font-display text-[1.375rem] tracking-[0.02em] text-black hover:text-[#4D4D4D] transition-colors duration-200"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {isLoaded && (
          <div className="shrink-0 px-6 pb-6 pt-4">
            <div className="rounded-lg border border-[#E2E2E2] bg-white px-3 py-2.5 text-jet">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ivory text-[#5F5F5F]">
                  <User size={14} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[0.95rem] leading-tight text-jet">
                    {isSignedIn ? "Signed in" : "Guest User"}
                  </p>
                </div>
              </div>

              {isSignedIn ? (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <Link
                    href="/account"
                    onClick={onClose}
                    className="flex w-full items-center justify-center rounded-full border border-[#CFCFCF] bg-white py-1.5 font-sans text-[0.75rem] font-medium text-jet hover:border-jet transition-colors duration-200"
                  >
                    View account
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      signOut();
                    }}
                    className="py-1 font-sans text-[0.72rem] text-[#5F5F5F] hover:text-jet transition-colors duration-200"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <Link
                  href="/sign-in"
                  onClick={onClose}
                  className="mt-2.5 flex w-full items-center justify-center rounded-full border border-[#CFCFCF] bg-white py-1.5 font-sans text-[0.75rem] font-medium text-jet hover:border-jet transition-colors duration-200"
                >
                  Tap to sign in / Login
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

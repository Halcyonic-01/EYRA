"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X, Search, ShoppingBag, User, Heart, LogOut } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Logo } from "@/components/ui/Logo";
import { useSignOut } from "@/components/auth/useSignOut";
import { useWalletBalance } from "@/components/wallet/useWalletBalance";
import { WalletChip } from "@/components/wallet/WalletChip";
import { formatRupees } from "@/lib/money";
import { useCartStore } from "@/store/useStore";
import { useWishlistStore } from "@/store/useStore";

const NAV_ITEMS = [
  { label: "Collections", href: "/collections"        },
  { label: "For Her",     href: "/collections/for-her" },
  { label: "For Him",     href: "/collections/for-him" },
  { label: "New Arrivals", href: "/new-arrivals" },
  { label: "About",       href: "/about"        },
  { label: "Contact",     href: "/contact"      },
] as const;

/* Mobile-only category row, shown under the primary bar below lg. */
const CATEGORY_ITEMS = [
  { label: "For Her", href: "/collections/for-her" },
  { label: "For Him", href: "/collections/for-him" },
] as const;

export function Navbar() {
  const [scrolled,  setScrolled]  = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const wishlistCount = useWishlistStore((s) => s.items.length);
  // Clerk v7 dropped the <SignedIn>/<SignedOut> components, and its <Show> is a
  // server component, so a client component reads auth state via the hook.
  // Gate on isLoaded so the auth controls do not flip after hydration.
  const { isLoaded, isSignedIn } = useAuth();
  const signOut = useSignOut();
  // Spendable wallet credit, shown next to the account icon when there is any.
  const wallet = useWalletBalance(Boolean(isLoaded && isSignedIn));
  const walletHint = wallet?.nextExpiry
    ? `${formatRupees(wallet.nextExpiry.amount)} expires on ${new Date(wallet.nextExpiry.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
    : "Your wallet credit";

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchValue.trim();
    setSearchOpen(false);
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  // The header is fixed over the page's own content, and at the top of the
  // homepage that content is the white announcement strip and heading, not a
  // dark hero image. A transparent header with light/pearl text there was
  // reading as near-invisible white-on-white. Only once `scrolled` swaps in
  // the solid charcoal backdrop did the light text become legible, so "dark
  // theme" now tracks the backdrop that is actually dark, not just "home page".
  const darkTheme = isHome && scrolled;

  return (
    <>
      {/* ── Fixed top bar ─────────────────────────────── */}
      <header
        className={[
          "fixed top-0 inset-x-0 z-50 flex flex-col transition-all duration-300",
          darkTheme
            ? "bg-charcoal/95 backdrop-blur-md border-b border-white/10"
            : "bg-white/90 backdrop-blur-md border-b border-[#CFCFCF]",
        ].join(" ")}
        style={{ height: "var(--nav-height)" }}
      >
        <div
          className={[
            "max-w-screen-xl mx-auto px-6 lg:px-10 w-full flex items-center justify-between",
            darkTheme ? "text-white" : "text-black",
          ].join(" ")}
          style={{ height: "var(--bar-height)" }}
        >
          {/* Logo */}
          <Logo variant={darkTheme ? "light" : "dark"} size="xl" />

          {/* Desktop nav */}
          <nav
            className="hidden lg:flex items-center gap-6 xl:gap-8"
            aria-label="Primary navigation"
          >
            {NAV_ITEMS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={[
                  "text-[0.72rem] font-sans font-medium tracking-[0.16em] uppercase transition-colors duration-200",
                  darkTheme
                    ? "text-pearl hover:text-white"
                    : "text-[#3D3D3D] hover:text-black",
                ].join(" ")}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Action icons */}
          <div className="flex items-center gap-0.5">
            <button
              aria-label={searchOpen ? "Close search" : "Search"}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((prev) => !prev)}
              className={[
                "p-2.5 transition-colors duration-200",
                darkTheme ? "text-pearl hover:text-white" : "text-[#333] hover:text-black",
              ].join(" ")}
            >
              {searchOpen
                ? <X size={17} strokeWidth={1.5} />
                : <Search size={17} strokeWidth={1.5} />
              }
            </button>
            {/* Account: signed-in users go to their profile, guests to sign-in.
                This is deliberately the sole account entry point in the header,
                no separate text "Sign in" / "Sign up" links. */}
            {wallet && wallet.balance > 0 && (
              <WalletChip balance={wallet.balance} hint={walletHint} dark={darkTheme} />
            )}
            <Link
              href={isSignedIn ? "/account" : "/sign-in"}
              aria-label={isSignedIn ? "Your account" : "Sign in"}
              className={[
                "p-2.5 transition-colors duration-200 block",
                darkTheme ? "text-pearl hover:text-white" : "text-[#333] hover:text-black",
              ].join(" ")}
            >
              <User size={17} strokeWidth={1.5} />
            </Link>
            {isLoaded && isSignedIn && (
              <button
                type="button"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
                className={[
                  "hidden sm:block p-2.5 transition-colors duration-200",
                  darkTheme ? "text-pearl hover:text-white" : "text-[#333] hover:text-black",
                ].join(" ")}
              >
                <LogOut size={17} strokeWidth={1.5} />
              </button>
            )}
            <Link
              href="/wishlist"
              aria-label="Wishlist"
              className={[
                "relative p-2.5 transition-colors duration-200",
                darkTheme ? "text-pearl hover:text-white" : "text-[#333] hover:text-black",
              ].join(" ")}
            >
              <Heart size={17} strokeWidth={1.5} />
              {wishlistCount > 0 && (
                <span className={[
                  "absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-sans font-medium leading-none",
                  darkTheme ? "bg-white text-black" : "bg-black text-white",
                ].join(" ")}>
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>
              )}
            </Link>
            <Link
              href="/cart"
              aria-label="Cart"
              className={[
                "relative p-2.5 transition-colors duration-200",
                darkTheme ? "text-pearl hover:text-white" : "text-[#333] hover:text-black",
              ].join(" ")}
            >
              <ShoppingBag size={17} strokeWidth={1.5} />
              {cartCount > 0 && (
                <span className={[
                  "absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-sans font-medium leading-none",
                  darkTheme ? "bg-white text-black" : "bg-black text-white",
                ].join(" ")}>
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

          </div>
        </div>

        {/* Category row, mobile only. Desktop shows these in the primary nav. */}
        <nav
          className="lg:hidden flex items-center justify-center gap-9"
          style={{ height: "var(--subnav-height)" }}
          aria-label="Shop by category"
        >
          {CATEGORY_ITEMS.map(({ label, href }) => {
            const active = pathname?.startsWith(href) ?? false;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "font-display text-[0.95rem] tracking-[0.12em] underline underline-offset-[6px] decoration-[0.5px] transition-colors duration-200",
                  active
                    ? darkTheme ? "text-white decoration-white" : "text-black decoration-black"
                    : [
                        "decoration-transparent",
                        darkTheme ? "text-pearl hover:text-white" : "text-[#7A7A7A] hover:text-black",
                      ].join(" "),
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* ── Search panel ──────────────────────────────── */}
      {searchOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSearchOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed inset-x-0 z-50 bg-white border-b border-[#CFCFCF] shadow-sm"
            style={{ top: "var(--nav-height)" }}
          >
            <form
              onSubmit={submitSearch}
              className="max-w-screen-xl mx-auto px-6 lg:px-10 py-6 flex items-center gap-4"
              role="search"
            >
              <Search size={18} strokeWidth={1.5} className="text-[#909090] shrink-0" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search rings, chains, anklets…"
                aria-label="Search products"
                className="flex-1 bg-transparent font-sans font-light text-[16px] text-black placeholder:text-[#909090] focus:outline-none"
              />
              <button
                type="submit"
                className="font-sans font-medium text-[14px] text-black underline underline-offset-2 hover:text-[#626262] transition-colors duration-200 shrink-0"
              >
                Search
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Search, ShoppingBag, User, Heart, LogOut } from "lucide-react";
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

export function Navbar() {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
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

  /* Prevent body scroll while mobile menu is open */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

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
          "fixed top-0 inset-x-0 z-50 transition-all duration-300",
          darkTheme
            ? "bg-charcoal/95 backdrop-blur-md border-b border-white/10"
            : "bg-white/90 backdrop-blur-md border-b border-[#CFCFCF]",
        ].join(" ")}
        style={{ height: "var(--nav-height)" }}
      >
        <div className={[
          "max-w-screen-xl mx-auto px-6 lg:px-10 h-full flex items-center justify-between",
          darkTheme ? "text-white" : "text-black",
        ].join(" ")}>
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

            {/* Hamburger, mobile only */}
            <button
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              className={[
                "p-2.5 transition-colors duration-200 lg:hidden",
                darkTheme ? "text-pearl hover:text-white" : "text-[#333] hover:text-black",
              ].join(" ")}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {menuOpen
                ? <X    size={19} strokeWidth={1.5} />
                : <Menu size={19} strokeWidth={1.5} />
              }
            </button>
          </div>
        </div>
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

      {/* ── Mobile full-screen overlay ─────────────────── */}
      <div
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!menuOpen}
        className={[
          "fixed inset-0 z-40 bg-charcoal flex flex-col",
          "transition-transform duration-300 ease-in-out",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <nav
          className="flex flex-col gap-7 px-8 pb-12"
          style={{ paddingTop: "calc(var(--nav-height) + 3rem)" }}
          aria-label="Mobile navigation"
        >
          {NAV_ITEMS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={closeMenu}
              className="text-[2rem] font-display font-light tracking-[0.2em] uppercase text-white hover:text-silver transition-colors duration-200"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Account actions. Signed-out guests use the person icon in the
            header above, visible behind this drawer, rather than a duplicate
            set of buttons here. Signed-in shortcuts stay since "My orders"
            isn't otherwise reachable from the header icons. */}
        {isLoaded && isSignedIn && (
          <div className="px-8">
            <div className="flex flex-col gap-4">
              <Link
                href="/account"
                onClick={closeMenu}
                className="w-full text-center px-8 py-3.5 rounded-full bg-white text-black font-sans font-normal text-[0.72rem] tracking-[0.2em] uppercase hover:bg-pearl transition-colors duration-200"
              >
                My account
              </Link>
              <Link
                href="/orders"
                onClick={closeMenu}
                className="w-full text-center px-8 py-3.5 rounded-full border border-white/50 text-white font-sans font-normal text-[0.72rem] tracking-[0.2em] uppercase hover:border-white transition-colors duration-200"
              >
                My orders
              </Link>
              <Link
                href="/wallet"
                onClick={closeMenu}
                className="w-full text-center px-8 py-3.5 rounded-full border border-white/50 text-white font-sans font-normal text-[0.72rem] tracking-[0.2em] uppercase hover:border-white transition-colors duration-200"
              >
                {wallet && wallet.balance > 0 ? `My wallet · ${formatRupees(wallet.balance)}` : "My wallet"}
              </Link>
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  signOut();
                }}
                className="w-full text-center px-8 py-3.5 rounded-full text-pearl font-sans font-normal text-[0.72rem] tracking-[0.2em] uppercase underline underline-offset-4 hover:text-white transition-colors duration-200"
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        <div className="mt-auto px-8 pb-12 border-t border-stone/40 pt-6">
          <p className="text-[0.68rem] font-sans tracking-[0.2em] uppercase text-stone">
            Premium Sterling Silver
          </p>
        </div>
      </div>
    </>
  );
}

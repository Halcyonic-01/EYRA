"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, User, Heart, LogOut } from "lucide-react";
import { DeliveryCheckWidget } from "@/components/home/DeliveryCheckWidget";
import { useAuth } from "@clerk/nextjs";
import { Logo } from "@/components/ui/Logo";
import { MobileNav } from "@/components/layout/MobileNav";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const pathname = usePathname();
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
      <AnnouncementBanner />

      {/* ── Fixed top bar ─────────────────────────────── */}
      <header
        className={[
          "fixed top-0 inset-x-0 z-50 flex flex-col transition-all duration-300",
          darkTheme
            ? "bg-charcoal/95 backdrop-blur-md border-b border-white/10"
            : "bg-white/90 backdrop-blur-md border-b border-[#CFCFCF]",
        ].join(" ")}
        style={{ top: "var(--banner-height)", height: "var(--nav-height)" }}
      >
        <div
          className={[
            "max-w-screen-xl mx-auto px-6 lg:px-10 w-full flex items-center justify-between",
            darkTheme ? "text-white" : "text-black",
          ].join(" ")}
          style={{ height: "var(--bar-height)" }}
        >
          {/* Left: hamburger (below lg) beside the logo */}
          <div className="flex items-center min-w-0">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className={[
                "lg:hidden -ml-2.5 mr-1 p-2.5 transition-colors duration-200",
                darkTheme ? "text-pearl hover:text-white" : "text-[#333] hover:text-black",
              ].join(" ")}
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <Logo variant={darkTheme ? "light" : "dark"} size="xl" />
          </div>

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
            <DeliveryCheckWidget dark={darkTheme} />
            {/* Account: signed-in users go to their profile, guests to sign-in.
                Desktop only. Below lg, account lives in the drawer's guest card. */}
            {wallet && wallet.balance > 0 && (
              <WalletChip balance={wallet.balance} hint={walletHint} dark={darkTheme} />
            )}
            <Link
              href={isSignedIn ? "/account" : "/sign-in"}
              aria-label={isSignedIn ? "Your account" : "Sign in"}
              className={[
                "p-2.5 transition-colors duration-200 hidden lg:block",
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
              <Heart size={17} strokeWidth={1.5} className="text-[#D81B60]" />
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

      </header>

      {/* ── Mobile navigation drawer (below lg) ───────── */}
      <MobileNav open={menuOpen} onClose={closeMenu} />

    </>
  );
}

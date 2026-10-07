"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCartStore, useWishlistStore } from "@/store/useStore";

/**
 * Navbar and CartSyncBanner are themselves "use client" components, so
 * importing and instantiating them here would be fine either way. Footer
 * is not: it reads server-only env vars (storeConfig.seller.gstin, no
 * NEXT_PUBLIC_ prefix) directly. A Client Component that imports and renders
 * a Server Component module directly pulls it into the client bundle, so it
 * silently re-executes in the browser too, where that env var is undefined,
 * causing a server/client hydration mismatch. React recovers by discarding
 * and rebuilding the whole tree client-side, which was swallowing real user
 * interactions (e.g. an "Add to cart" click) that happened in that window.
 *
 * The fix is the pattern Next.js documents for this exact situation: the
 * actual Server Component (app/layout.tsx) renders Navbar/Footer/
 * CartSyncBanner itself and passes the already-rendered elements down as
 * props, so their module code only ever runs on the server.
 */
export function AppShell({
  children,
  navbar,
  footer,
  cartSyncBanner,
  authBackdrop,
}: {
  children: React.ReactNode;
  navbar: React.ReactNode;
  footer: React.ReactNode;
  cartSyncBanner: React.ReactNode;
  /** What shows, dimmed, behind the sign-in and sign-up window. */
  authBackdrop: React.ReactNode;
}) {
  const pathname = usePathname();
  const initCart = useCartStore((s) => s.initCart);
  const initWishlist = useWishlistStore((s) => s.initWishlist);

  useEffect(() => {
    initCart();
    initWishlist();
  }, [initCart, initWishlist]);
  const isAuth =
    pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  if (isAuth) {
    return (
      <>
        {/* The shop stays visible behind the window; inert so nothing in it can be reached. */}
        <div aria-hidden="true" inert className="pointer-events-none select-none">
          {navbar}
          <div style={{ paddingTop: "var(--nav-height)" }}>{authBackdrop}</div>
        </div>
        {children}
      </>
    );
  }

  return (
    <>
      {navbar}
      <main className="flex-1" style={{ paddingTop: "var(--nav-height)" }}>
        {children}
      </main>
      {footer}
      {cartSyncBanner}
    </>
  );
}

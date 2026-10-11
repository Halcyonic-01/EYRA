"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Logo } from "@/components/ui/Logo";

/**
 * The sign-in and sign-up window. It sits over the dimmed storefront (rendered
 * by AppShell) as a centred card, and as a bottom sheet on phones.
 */
export function AuthOverlay({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // Escape returns to the shop. Going "back" could land on the page that sent us here.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-jet/60 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Account sign in"
        className="auth-rise relative max-h-[94dvh] w-full overflow-y-auto rounded-t-[22px] bg-white px-6 pb-8 pt-3 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:max-w-[480px] sm:rounded-[18px] sm:px-11 sm:pb-9 sm:pt-9"
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D6D6D6] sm:hidden" />

        <Link
          href="/"
          aria-label="Close and return to the shop"
          className="absolute right-4 top-4 hidden h-9 w-9 items-center justify-center rounded-full bg-[#F2F2F2] text-[#444] transition-colors duration-200 hover:bg-[#E6E6E6] sm:flex"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>

        <div className="mb-3 flex items-center justify-between sm:mb-5 sm:block">
          <Logo variant="dark" size="lg" />
          <Link href="/" className="font-sans text-[13px] text-[#626262] underline underline-offset-4 sm:hidden">
            Close
          </Link>
        </div>

        {children}

        <p className="mt-5 text-center font-sans text-[11px] leading-relaxed text-[#8A8A8A]">
          By continuing you agree to our{" "}
          <Link href="/terms-of-service" className="underline underline-offset-2">Terms</Link> and{" "}
          <Link href="/privacy-policy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

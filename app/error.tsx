"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function ErrorBoundary({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[EYRA] Unhandled route error:", error);
    // A server error (it has a digest) was already reported by onRequestError; this copy has its message hidden.
    if (!error.digest) Sentry.captureException(error);
  }, [error]);

  return (
    <div className="max-w-screen-xl mx-auto px-6 lg:px-10 py-24 flex flex-col items-center gap-6 text-center">
      <svg
        width="72"
        height="72"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#CFCFCF"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div className="flex flex-col gap-2">
        <h1 className="font-display font-light italic text-[clamp(1.75rem,3vw,2.5rem)] text-black">
          Something Went Wrong
        </h1>
        <p className="font-sans font-normal text-[16px] text-[#909090] max-w-[420px]">
          An unexpected error occurred. Please try again, or contact support if the problem persists.
        </p>
      </div>
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={() => unstable_retry()}
          className="px-8 py-[14px] bg-black text-white font-sans font-medium text-[16px] rounded-full hover:bg-[#1a1a1a] transition-colors duration-200"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-8 py-[14px] border border-[#CFCFCF] text-black font-sans font-medium text-[16px] rounded-full hover:bg-[#F7F7F7] transition-colors duration-200"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

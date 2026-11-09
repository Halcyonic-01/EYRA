"use client";

import { useEffect, useState } from "react";
import { TOTE_MIN_SUBTOTAL } from "@/config/offers";

const DIAMOND = "◆";

// Kept short so each message fits on one line on small phones (the bar is truncated, not wrapped).
const MESSAGES = [
  `${DIAMOND} EYRA Launch Sale is Live Now! ${DIAMOND}`,
  `Complimentary tote bag above ₹${TOTE_MIN_SUBTOTAL.toLocaleString("en-IN")}!`,
  "Easy Return and Exchange!",
];

// Each message stays on screen 1 second longer than before (2.5s → 3.5s).
const INTERVAL_MS = 3500;

// Desktop ticker: the launch sale line, repeated, sliding right to left.
const TICKER_COPIES = 16;

function TickerGroup({ hidden }: { hidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {Array.from({ length: TICKER_COPIES }, (_, i) => (
        <span key={i} className="flex items-center">
          <span>{DIAMOND} Launch Sale!</span>
          <span className="px-6 sm:px-8" aria-hidden="true">
            {DIAMOND}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Slim announcement bar fixed above the header.
 * - Below lg: cycles through MESSAGES, re-keyed so the fade-up replays.
 * - lg and up: the launch sale ticker scrolls right to left and pauses on hover.
 */
export function AnnouncementBanner() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % MESSAGES.length),
      INTERVAL_MS
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      role="region"
      aria-label="Announcements"
      className="marquee fixed inset-x-0 top-0 z-50 flex items-center justify-center overflow-hidden bg-crimson px-4 text-white"
      style={{ height: "var(--banner-height)" }}
    >
      <p
        key={index}
        className="banner-text truncate text-center font-sans text-[0.66rem] sm:text-[0.72rem] font-normal tracking-[0.16em] uppercase lg:hidden"
      >
        {MESSAGES[index]}
      </p>

      <div className="hidden h-full w-full overflow-hidden lg:flex lg:items-center">
        <span className="sr-only">Launch sale</span>
        <div className="marquee-track flex w-max whitespace-nowrap font-sans text-[0.72rem] font-normal uppercase tracking-[0.3em] will-change-transform">
          <TickerGroup hidden />
          <TickerGroup hidden />
        </div>
      </div>
    </div>
  );
}

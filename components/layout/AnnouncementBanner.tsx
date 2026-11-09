"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "EYRA Launch Sale is Live Now!",
  "Complimentary tote bag on purchase above ₹1,500",
  "Easy Return and Exchange",
];

const INTERVAL_MS = 2500;

/**
 * Slim announcement bar fixed above the header. Cycles through MESSAGES.
 * The text is re-keyed on each change so the fade-up animation replays.
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
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center overflow-hidden bg-charcoal px-4 text-white"
      style={{ height: "var(--banner-height)" }}
    >
      <p
        key={index}
        className="banner-text truncate text-center font-sans text-[0.66rem] sm:text-[0.72rem] font-normal tracking-[0.16em] uppercase"
      >
        {MESSAGES[index]}
      </p>
    </div>
  );
}

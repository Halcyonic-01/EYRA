"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Makes a newly opened page start at its top.
 *
 * Next.js scrolls to the top on navigation only when the new page's first element
 * is off screen. While the new page is still loading it is very short, so the browser
 * clamps the old scroll position to a small number (say 100px); the first element is
 * then "on screen", Next does not scroll, and once the content arrives the page is left
 * part-way down, under the header. This resets the scroll once the new route is in place.
 *
 * Left alone on purpose:
 *  - Back and forward, so the browser can restore where the customer was.
 *  - Links to a #section, which scroll to that section.
 *  - Changes that keep the same path (collection filters), which use scroll={false}.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  const fromHistory = useRef(false);

  useEffect(() => {
    const mark = () => {
      fromHistory.current = true;
    };
    window.addEventListener("popstate", mark);
    return () => window.removeEventListener("popstate", mark);
  }, []);

  useLayoutEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (fromHistory.current) {
      fromHistory.current = false;
      return;
    }
    if (window.location.hash) return;
    // "instant" so it never glides, whatever scroll-behavior the page sets.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}

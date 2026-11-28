"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { analyticsEnabled, readConsent, setConsent, subscribeConsent } from "@/lib/analytics/client";
import { encodeConsent } from "@/lib/analytics/consent";

/** Opens the banner again from anywhere (the footer's "Analytics settings"). */
export const OPEN_CONSENT_EVENT = "eyra:analytics-settings";

/**
 * Asks before any analytics runs. Shown until the customer chooses, and again
 * from "Analytics settings" to change or withdraw the choice. "Accept" and
 * "Decline" carry equal weight: saying no is as easy as saying yes.
 */
export function ConsentBanner() {
  // The choice as a string, so React compares it by value.
  const choice = useSyncExternalStore(
    subscribeConsent,
    () => {
      const consent = readConsent();
      return consent ? encodeConsent(consent) : "";
    },
    () => "server"
  );
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, []);

  if (!analyticsEnabled() || choice === "server") return null;
  if (choice && !reopened) return null;
  const current = choice.startsWith("granted") ? "granted" : choice.startsWith("denied") ? "denied" : null;

  const choose = (status: "granted" | "denied") => {
    setReopened(false);
    setConsent(status);
  };

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="consent-title" className="fixed bottom-0 inset-x-0 z-[60] flex justify-center px-4 pb-5">
      <div className="w-full max-w-xl rounded-2xl border border-[#CFCFCF] bg-white p-5 shadow-lg">
        <h2 id="consent-title" className="font-sans text-[15px] font-semibold text-black">
          Your privacy at EYRA
        </h2>
        <p className="mt-2 font-sans text-[14px] leading-relaxed text-[#5a5a5a]">
          With your permission, we use PostHog analytics to understand how our collections are explored, such as
          which pieces are viewed and where checkout could be smoother, so we can refine your experience. Analytics
          is entirely optional and never used for advertising; nothing is collected unless you accept. You may
          change or withdraw your choice at any time under &ldquo;Analytics settings&rdquo; at the foot of every
          page. <Link href="/privacy-policy" className="underline">Privacy Policy</Link>
        </p>
        {current && (
          <p className="mt-2 font-sans text-[13px] text-[#909090]">
            Your current choice: {current === "granted" ? "analytics enabled" : "analytics declined"}.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => choose("granted")}
            className="flex-1 min-w-[140px] rounded-full bg-black px-6 py-3 font-sans text-[15px] font-medium text-white"
          >
            Accept analytics
          </button>
          <button
            type="button"
            onClick={() => choose("denied")}
            className="flex-1 min-w-[140px] rounded-full bg-black px-6 py-3 font-sans text-[15px] font-medium text-white"
          >
            {current === "granted" ? "Withdraw consent" : "Decline"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The footer's list item: reopens the banner. Absent when analytics is not configured. */
export function ConsentSettingsLink({ className }: { className?: string }) {
  if (!analyticsEnabled()) return null;
  return (
    <li>
      <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
        Analytics settings
      </button>
    </li>
  );
}

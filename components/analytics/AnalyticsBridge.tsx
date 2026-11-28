"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { applyRecordingRules, followConsentInOtherTabs, identifyCustomer, initAnalytics, resetIdentity, syncConsentOnce } from "@/lib/analytics/client";

/**
 * Keeps PostHog in step with the app: who is signed in, and whether this page
 * may be recorded. Renders nothing.
 *
 * The person id is the Medusa customer id Clerk keeps in public metadata (set
 * on first sign-in), never the email. Until it is there the customer stays
 * anonymous; signing out starts a new anonymous visitor.
 */
export function AnalyticsBridge() {
  const { isLoaded, isSignedIn, user } = useUser();
  const pathname = usePathname();
  const customerId = user?.publicMetadata?.medusaCustomerId;

  useEffect(() => {
    // PostHog starts here, not in instrumentation-client.ts: only with consent, after the page is up.
    initAnalytics();
    followConsentInOtherTabs();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && typeof customerId === "string") {
      identifyCustomer(customerId);
      // The backend follows this device's choice for the customer's orders.
      syncConsentOnce();
    }
    if (!isSignedIn) resetIdentity();
  }, [isLoaded, isSignedIn, customerId]);

  useEffect(() => {
    applyRecordingRules(pathname);
  }, [pathname]);

  return null;
}

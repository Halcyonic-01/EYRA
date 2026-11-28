import { NextRequest, NextResponse } from "next/server";

import { CONSENT_VERSION, type Consent } from "@/lib/analytics/consent";
import { getCurrentUser } from "@/lib/current-user";
import { setCustomerAnalyticsConsent } from "@/lib/medusa-customer";
import { applyRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/analytics/consent  { status, at, version }
 *
 * Copies the analytics choice made in this browser onto the signed-in
 * customer's Medusa profile, so the backend sends order events only for a
 * customer who said yes (and stops when they withdraw). A visitor who is not
 * signed in has nothing to store: { stored: false }, and the browser sends it
 * again after sign-in.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, "analytics_consent", 120);
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as Partial<Consent> | null;
  const status = body?.status;
  const at = typeof body?.at === "string" ? new Date(body.at) : null;
  if ((status !== "granted" && status !== "denied") || !at || Number.isNaN(at.getTime()) || body?.version !== CONSENT_VERSION) {
    return NextResponse.json({ error: "Invalid consent." }, { status: 400 });
  }
  // The time the choice was made; never in the future (it decides which orders it covers).
  const when = new Date(Math.min(at.getTime(), Date.now())).toISOString();

  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    // Clerk unreachable: treated as signed out; the browser sends it again later.
  }
  const customerId = user?.publicMetadata?.medusaCustomerId;
  if (typeof customerId !== "string") return NextResponse.json({ stored: false });

  const stored = await setCustomerAnalyticsConsent(customerId, { status, at: when, version: CONSENT_VERSION });
  if (!stored) console.error(`[analytics-consent] could not record the choice for customer ${customerId}`);
  return NextResponse.json({ stored }, { status: stored ? 200 : 502 });
}

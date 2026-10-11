/**
 * Server-only: Medusa Admin API helpers for customer provisioning.
 *
 * Required env vars:
 *   MEDUSA_ADMIN_API_KEY  , Admin API token from the Medusa dashboard
 *                            (Settings → API key management → Create API key)
 *   NEXT_PUBLIC_MEDUSA_BACKEND_URL, e.g. http://localhost:9000
 */
import "server-only";

import type { User } from "@clerk/backend";
import { clerkClient } from "@clerk/nextjs/server";

const BASE_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

const ADMIN_KEY = process.env.MEDUSA_ADMIN_API_KEY ?? "";

/* ── Raw Admin API types ──────────────────────────────────── */

interface MedusaCustomer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  has_account: boolean;
}

interface MedusaCustomerListResponse {
  customers: MedusaCustomer[];
  count: number;
}

interface MedusaCustomerResponse {
  customer: MedusaCustomer;
}

/* ── Base fetch ───────────────────────────────────────────── */

async function adminFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T | null> {
  if (!ADMIN_KEY) {
    console.warn("[medusa-customer] MEDUSA_ADMIN_API_KEY is not set, skipping customer sync");
    return null;
  }

  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        // Secret API keys (sk_...) authenticate via HTTP Basic, not a
        // custom header or Bearer, confirmed against Medusa's own
        // authenticate-middleware, which parses `Authorization: Basic sk_...`.
        Authorization: `Basic ${ADMIN_KEY}`,
        ...(init?.headers ?? {}),
      },
      // Never cache Admin API responses
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[medusa-customer] ${res.status} ${res.statusText}, ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("[medusa-customer] fetch error:", err);
    return null;
  }
}

/* ── Customer CRUD ────────────────────────────────────────── */

async function findCustomerByEmail(
  email: string
): Promise<MedusaCustomer | null> {
  const data = await adminFetch<MedusaCustomerListResponse>(
    `/admin/customers?email=${encodeURIComponent(email)}&limit=1&fields=id,email,first_name,last_name,phone,has_account`
  );
  return data?.customers?.[0] ?? null;
}

async function createCustomer(params: {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}): Promise<MedusaCustomer | null> {
  const data = await adminFetch<MedusaCustomerResponse>("/admin/customers", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      first_name: params.firstName ?? undefined,
      last_name: params.lastName ?? undefined,
      phone: params.phone ?? undefined,
    }),
  });
  return data?.customer ?? null;
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Idempotently provisions a Medusa customer for the given Clerk user.
 *
 * On first call for a user:
 *   1. Looks up an existing Medusa customer by primary email address.
 *   2. Creates one if none is found, copying over name and phone number.
 *   3. Writes the Medusa customer ID to Clerk publicMetadata so subsequent
 *      calls short-circuit immediately (no Admin API round-trip needed).
 *
 * On subsequent calls, returns the stored ID from Clerk metadata instantly.
 *
 * Returns the Medusa customer ID, or null if the backend is unreachable.
 */
export async function syncMedusaCustomer(
  user: User
): Promise<string | null> {
  // Short-circuit: already bound on a previous sign-in
  const existingId = user.publicMetadata?.medusaCustomerId;
  if (existingId) return existingId;

  // Resolve primary email
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  // Only a verified address may be matched to an existing customer, or anyone
  // could sign up with someone else's email and take over their orders.
  if (!primary || primary.verification?.status !== "verified") return null;
  const primaryEmail = primary.emailAddress;

  try {
    // Step 1: find an existing Medusa customer with this email
    let customer = await findCustomerByEmail(primaryEmail);

    // Step 2: provision a new one if none found
    if (!customer) {
      const primaryPhone =
        user.phoneNumbers.find((p) => p.id === (user as unknown as { primaryPhoneNumberId?: string }).primaryPhoneNumberId)
          ?.phoneNumber ?? null;

      customer = await createCustomer({
        email: primaryEmail,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: primaryPhone,
      });
    }

    if (!customer) return null;

    // Step 3: bind the Medusa customer ID to the Clerk profile so this
    // lookup only runs once per user account lifetime.
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(user.id, {
      publicMetadata: { medusaCustomerId: customer.id },
    });

    return customer.id;
  } catch (err) {
    // Non-fatal: the storefront works fine without a synced customer profile.
    // The sync will be retried on the next page load.
    console.error("[medusa-customer] sync failed:", err);
    return null;
  }
}

/**
 * Server-only: who is the signed-in customer, in Medusa's terms.
 *
 * Clerk owns sign-in. On first sign-in the customer is provisioned in Medusa
 * and its id is stored in the Clerk user's public metadata.
 */
import "server-only";

import { getCurrentUser } from "@/lib/current-user";

export interface WalletCustomer {
  /** Medusa customer id (cus_...). */
  customerId: string;
  /** Clerk's primary email for the user, lowercase. */
  email: string;
  /** For addressing the customer in messages to our team. */
  name: string;
}

/** Null for guests and for users not yet provisioned in Medusa. */
export async function getWalletCustomer(): Promise<WalletCustomer | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const customerId = user.publicMetadata?.medusaCustomerId;
  const email = user.primaryEmailAddress?.emailAddress;
  if (typeof customerId !== "string" || !email) return null;

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || email;
  return { customerId, email: email.toLowerCase(), name };
}

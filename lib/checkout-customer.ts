/**
 * Server-only: the email an order is placed under.
 *
 * Medusa links an order to whichever customer account has the cart's email,
 * so that email must come from the signed-in Clerk user, never from the
 * request body.
 */
import "server-only";

import { getCurrentUser } from "@/lib/current-user";

export const SIGN_IN_REQUIRED = {
  error: "sign_in_required",
  message: "Please sign in with a verified email address to place your order.",
};

/** The signed-in user's verified primary email, lowercase. Null otherwise. */
export async function getCheckoutEmail(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  if (!primary || primary.verification?.status !== "verified") return null;

  return primary.emailAddress.toLowerCase();
}

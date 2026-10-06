import { currentUser } from "@clerk/nextjs/server";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";

/**
 * The signed-in Clerk user, or null when there is none.
 *
 * A browser can keep a valid session for an account that has since been
 * deleted. Clerk then answers 404 for the user, and that must read as signed
 * out, not as an error that takes the page down.
 */
export async function getCurrentUser() {
  try {
    return await currentUser();
  } catch (err) {
    if (isClerkAPIResponseError(err) && err.status === 404) return null;
    throw err;
  }
}

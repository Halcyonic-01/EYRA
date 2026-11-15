/**
 * After Shiprocket refuses the sign-in, do not ask again for a while: the same
 * email and password will be refused again, and every page that needs the token
 * would otherwise wait for a failed request and log the same error. Free of
 * server-only code so the rule can be tested on its own.
 */
export const LOGIN_RETRY_MS = 5 * 60 * 1000;

/** True when a sign-in may be tried now: none has failed, or the wait is over. */
export function loginAllowed(failedAt: number | null, now: number): boolean {
  return failedAt === null || now - failedAt >= LOGIN_RETRY_MS;
}

/** What to tell the developer about a refused sign-in. */
export function loginFailureHint(status: number): string {
  if (status === 401 || status === 403) {
    return "Shiprocket refused the SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD. Use the API user created under Settings > API > Configure in Shiprocket, not the main account login. Falling back to SHIPROCKET_API_TOKEN, and not asking again for 5 minutes.";
  }
  return "Shiprocket's sign-in did not answer as expected. Falling back to SHIPROCKET_API_TOKEN, and not asking again for 5 minutes.";
}

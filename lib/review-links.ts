/**
 * Review links, as the storefront checks them. The backend makes each link
 * (https://<site>/review/<43-character token>); an email must only ever point
 * at a review page on this site, so a link is refused unless it is one.
 */

type Env = Record<string, string | undefined>;

export const REVIEW_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function wellFormedReviewToken(token: unknown): token is string {
  return typeof token === "string" && REVIEW_TOKEN_RE.test(token);
}

/** Our live site, or (outside production) the local storefront. Always /review/<token>. */
export function reviewLinkAllowed(url: string, env: Env = process.env): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const [, first, token, ...rest] = parsed.pathname.split("/");
  if (first !== "review" || !wellFormedReviewToken(token) || rest.length || parsed.username || parsed.password) return false;
  const own = parsed.protocol === "https:" && (parsed.hostname === "www.eyra.org.in" || parsed.hostname === "eyra.org.in");
  if (own) return true;
  const site = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    try {
      if (new URL(site).origin === parsed.origin) return true;
    } catch {
      // fall through
    }
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  return local && env.NODE_ENV !== "production";
}

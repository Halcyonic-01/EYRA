/**
 * The URL without its trailing slash, or null when it has none (the root
 * keeps its slash). next.config turns off Next's own trailing-slash redirect
 * because PostHog's proxy paths need their slashes; proxy.ts applies this to
 * every other request instead, so /about/ still redirects to /about.
 */
export function trailingSlashRedirect(url: URL): URL | null {
  if (url.pathname.length <= 1 || !url.pathname.endsWith("/")) return null;
  const target = new URL(url.toString());
  target.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return target;
}

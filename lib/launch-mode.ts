/**
 * Launch / maintenance mode flag.
 *
 * LAUNCH_MODE is read at request time (server-only). NEXT_PUBLIC_LAUNCH_MODE
 * is accepted as an alias, but note Next inlines NEXT_PUBLIC_* at build time,
 * so changing it needs a redeploy; prefer LAUNCH_MODE.
 */
export const LAUNCH_PATH = "/launching-soon";

/** Set by proxy.ts so the root layout can skip the store chrome. */
export const LAUNCH_HEADER = "x-launch-mode";

/** 08 Nov 2026, 00:00 IST. */
export const LAUNCH_DATE_ISO = "2026-11-08T00:00:00+05:30";

export function isLaunchMode(): boolean {
  const raw = process.env.LAUNCH_MODE ?? process.env.NEXT_PUBLIC_LAUNCH_MODE;
  return raw?.trim().toLowerCase() === "true";
}

/**
 * Paths that must keep working while launch mode is on: backend APIs and
 * webhooks (Razorpay, tracking, revalidate, admin), the launch page itself
 * (and its OG image), and crawler files. Static assets are already excluded
 * by the proxy matcher.
 */
export function isLaunchExempt(pathname: string): boolean {
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/trpc") ||
    pathname === LAUNCH_PATH ||
    pathname.startsWith(`${LAUNCH_PATH}/`) ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

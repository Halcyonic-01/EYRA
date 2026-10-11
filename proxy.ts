import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  LAUNCH_HEADER,
  LAUNCH_PATH,
  isLaunchExempt,
  isLaunchMode,
} from "@/lib/launch-mode";

// /cart is deliberately not protected, guests can build a cart via
// localStorage + a server-side Medusa cart ID without an account, and only
// need to sign in once they actually proceed to /checkout.
const isProtectedRoute = createRouteMatcher([
  "/checkout(.*)",
  "/orders(.*)",
  "/account(.*)",
  "/wallet(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // Launch mode: every storefront page serves the "Launching Soon" page.
  // APIs/webhooks and the launch page itself stay reachable (see
  // isLaunchExempt). Runs before auth so nothing is gated behind sign-in.
  if (isLaunchMode()) {
    const { pathname } = request.nextUrl;
    const headers = new Headers(request.headers);
    headers.set(LAUNCH_HEADER, "1");
    if (pathname === LAUNCH_PATH) {
      return NextResponse.next({ request: { headers } });
    }
    if (!isLaunchExempt(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = LAUNCH_PATH;
      return NextResponse.rewrite(url, { request: { headers } });
    }
    return;
  }

  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

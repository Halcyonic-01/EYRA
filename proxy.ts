import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

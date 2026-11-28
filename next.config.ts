import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

import { imageRemotePatterns } from "./config/image-hosts";

/**
 * Browser security headers for every response. The CSP only covers framing,
 * plugins and <base>; a script allowlist would need nonces for Clerk,
 * Razorpay and Sentry, so it is left for a report-only rollout.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
  // Older browsers that ignore frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // pdfmake reads its fonts from disk, so it stays a real Node module rather
  // than being bundled, and the routes that draw invoices ship those files.
  serverExternalPackages: ["pdfmake"],
  outputFileTracingIncludes: {
    "/api/invoices/**": ["./node_modules/pdfmake/fonts/**", "./public/images/logo-eyra-black.svg"],
    "/orders/**": ["./node_modules/pdfmake/fonts/**", "./public/images/logo-eyra-black.svg"],
  },

  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },

  // Policy pages briefly lived under /legal/* before the final URL scheme was
  // settled. These keep any saved or shared link resolving.
  async redirects() {
    return [
      { source: "/legal/privacy", destination: "/privacy-policy", permanent: true },
      { source: "/legal/terms", destination: "/terms-of-service", permanent: true },
      { source: "/legal/shipping", destination: "/shipping-policy", permanent: true },
      { source: "/legal/returns", destination: "/refund-policy", permanent: true },
      // The returns policy tells customers to visit /returns to start a return.
      { source: "/returns", destination: "/refund-policy", permanent: false },
      { source: "/terms", destination: "/terms-of-service", permanent: true },
      { source: "/privacy", destination: "/privacy-policy", permanent: true },
    ];
  },

  images: {
    // Exact hosts only (see config/image-hosts.ts). The S3 bucket or its CDN is
    // added through MEDUSA_IMAGE_HOSTS, not by allowing every bucket on S3.
    remotePatterns: imageRemotePatterns(process.env),

    // Next refuses to fetch from a private address such as localhost, so locally
    // uploaded images (Medusa's /static on :9000) would not load in development.
    // Only development gets this; production images come from S3 behind
    // media.eyra.org.in, and remotePatterns above still limits what can be fetched.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",

    // Cache each optimized image for 24 hours on Vercel's CDN edge.
    // The default is 60 s; a higher value dramatically reduces the number of
    // re-optimization calls counted against Vercel's image transformation quota.
    minimumCacheTTL: 86400,

    // Generate AVIF first (40–60 % smaller than JPEG at equal quality),
    // then WebP as the fallback for browsers that don't support AVIF.
    formats: ["image/avif", "image/webp"],
  },
};

// Source maps are uploaded to Sentry (readable stack traces) and then deleted
// from the build, so they are never served. Without SENTRY_AUTH_TOKEN (local
// builds, previews without it) no source maps are made at all.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // The release is the Git commit Vercel builds; events carry the same name (lib/monitoring/sentry.ts).
  release: { name: process.env.VERCEL_GIT_COMMIT_SHA, create: uploadSourceMaps },
  sourcemaps: { disable: !uploadSourceMaps, deleteSourcemapsAfterUpload: true },
  widenClientFileUpload: true,
  silent: !process.env.CI,
  // No build data is sent to Sentry beyond the source maps.
  telemetry: false,
});

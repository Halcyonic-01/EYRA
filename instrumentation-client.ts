import * as Sentry from "@sentry/nextjs";

import { browserTracePropagationTargets, sentryEnvironment, sentryOptions } from "./lib/monitoring/sentry";

// Browser errors. NEXT_PUBLIC_ values are inlined at build, so each is read by name here.
Sentry.init({
  ...sentryOptions({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: sentryEnvironment({
      override: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      vercel: process.env.NEXT_PUBLIC_VERCEL_ENV,
    }),
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  }),
  // Trace headers on this site's own requests only, never the analytics proxy (/ev).
  tracePropagationTargets: browserTracePropagationTargets(window.location.origin),
  // Errors from browser extensions and old-browser noise, not from EYRA's code.
  ignoreErrors: ["ResizeObserver loop limit exceeded", "ResizeObserver loop completed with undelivered notifications", "Non-Error promise rejection captured"],
  denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-(web-)?extension:\/\//],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

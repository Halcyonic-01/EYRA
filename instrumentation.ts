import * as Sentry from "@sentry/nextjs";

import { reportConsoleErrors } from "./lib/monitoring/console-errors";
import { sentryEnvironment, sentryOptions } from "./lib/monitoring/sentry";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" && process.env.NEXT_RUNTIME !== "edge") return;
  const backend = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

  Sentry.init({
    ...sentryOptions({
      dsn,
      environment: sentryEnvironment({ override: process.env.SENTRY_ENVIRONMENT ?? process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT, vercel: process.env.VERCEL_ENV }),
      release: process.env.VERCEL_GIT_COMMIT_SHA,
    }),
    // Trace headers go to the Medusa backend only, never to Razorpay, PayU, Shiprocket or Resend.
    tracePropagationTargets: backend ? [new URL(backend).origin] : [],
  });
  // Caught failures logged as "[area] …" (see the file).
  if (process.env.NEXT_RUNTIME === "nodejs" && dsn) reportConsoleErrors();
}

export const onRequestError = Sentry.captureRequestError;

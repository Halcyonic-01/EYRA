"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Catches crashes in the root layout itself, which app/error.tsx cannot,
 * it replaces the whole document, so it must define its own <html>/<body>.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[EYRA] Root layout crash:", error);
    // A server error (it has a digest) was already reported by onRequestError; this copy has its message hidden.
    if (!error.digest) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          textAlign: "center",
          padding: "1.5rem",
          background: "#f9f9f9",
          color: "#020202",
        }}
      >
        <h1 style={{ fontWeight: 300, fontStyle: "italic", fontSize: "2rem" }}>
          Something Went Wrong
        </h1>
        <p style={{ color: "#909090", maxWidth: 420 }}>
          An unexpected error occurred. Please try again, or contact support if the problem persists.
        </p>
        <button
          onClick={() => unstable_retry()}
          style={{
            padding: "14px 32px",
            background: "#000",
            color: "#fff",
            fontWeight: 500,
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      </body>
    </html>
  );
}

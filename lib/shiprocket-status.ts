import { jwtExpiry } from "@/lib/jwt-expiry";

/**
 * What would stop Shiprocket working, from the environment alone. Pure, so it
 * can be tested and reused. Never includes a secret in a message.
 */
export interface ShiprocketEnv {
  [key: string]: string | undefined;
  SHIPROCKET_API_TOKEN?: string;
  SHIPROCKET_EMAIL?: string;
  SHIPROCKET_PASSWORD?: string;
  SHIPROCKET_WEBHOOK_SECRET?: string;
  SHIPROCKET_PICKUP_LOCATION?: string;
}

export interface ShiprocketStatus {
  autoRenew: boolean;
  tokenExpiresAt: string | null;
  problems: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Warn this long before a fixed token runs out. */
export const TOKEN_WARNING_DAYS = 3;

export function shiprocketStatus(env: ShiprocketEnv | Record<string, string | undefined>, now: Date = new Date()): ShiprocketStatus {
  const problems: string[] = [];
  const autoRenew = Boolean(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD);
  const expiry = jwtExpiry(env.SHIPROCKET_API_TOKEN);

  if (!autoRenew && !env.SHIPROCKET_API_TOKEN) {
    problems.push(
      "Shiprocket is not set up: set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD (an API user) on the storefront so shipments can be created."
    );
  } else if (!autoRenew && env.SHIPROCKET_API_TOKEN) {
    if (!expiry) {
      problems.push(
        "SHIPROCKET_API_TOKEN is not a Shiprocket token (it is not a JWT). Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD so a token is fetched and renewed automatically."
      );
    } else if (expiry.getTime() <= now.getTime()) {
      problems.push(
        `SHIPROCKET_API_TOKEN expired on ${expiry.toISOString().slice(0, 10)}, so no shipment can be created. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD so it renews itself.`
      );
    } else if (expiry.getTime() - now.getTime() < TOKEN_WARNING_DAYS * DAY_MS) {
      problems.push(
        `SHIPROCKET_API_TOKEN expires on ${expiry.toISOString().slice(0, 10)}. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD so it renews itself, or paste a new token.`
      );
    }
  }

  if (!env.SHIPROCKET_WEBHOOK_SECRET) {
    problems.push("SHIPROCKET_WEBHOOK_SECRET is not set, so Shiprocket's tracking updates are rejected.");
  }
  if (!env.SHIPROCKET_PICKUP_LOCATION) {
    problems.push(
      'SHIPROCKET_PICKUP_LOCATION is not set, so pickups use the name "Primary". It must match a pickup location in the Shiprocket dashboard exactly.'
    );
  }

  return {
    autoRenew,
    tokenExpiresAt: expiry ? expiry.toISOString() : null,
    problems,
  };
}

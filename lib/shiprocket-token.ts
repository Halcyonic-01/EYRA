/**
 * Server-only: the Shiprocket API token. Their tokens expire after about ten
 * days, so when SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD (an API user) are set,
 * the token is fetched by logging in and renewed when it lapses. Without them,
 * the static SHIPROCKET_API_TOKEN is used as before.
 */
import "server-only";

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";
/** Renew well inside the ten days, in case the clocks differ. */
const LIFETIME_MS = 8 * 24 * 60 * 60 * 1000;

let cached: { token: string; expiresAt: number } | null = null;

export function hasShiprocketLogin(): boolean {
  return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

async function login(): Promise<string | null> {
  try {
    const res = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error("[shiprocket-token] login answered", res.status);
      return null;
    }
    const body = (await res.json()) as { token?: string };
    return typeof body.token === "string" && body.token ? body.token : null;
  } catch (err) {
    console.error("[shiprocket-token] login failed:", err);
    return null;
  }
}

/** A usable token, or null when none is configured. `forceRefresh` after a 401. */
export async function getShiprocketToken(forceRefresh = false): Promise<string | null> {
  if (hasShiprocketLogin()) {
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.token;
    const token = await login();
    if (token) {
      cached = { token, expiresAt: Date.now() + LIFETIME_MS };
      return token;
    }
  }
  return process.env.SHIPROCKET_API_TOKEN || null;
}

import { Ratelimit } from "@upstash/ratelimit";
import type { NextRequest } from "next/server";
import { redis } from "@/lib/redis";

const TOO_MANY_REQUESTS = {
  error: "Submission frequency exceeded. Please try again later.",
};

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1"
  );
}

/**
 * Checks the rate limit for the calling IP against the given namespace.
 *
 * Returns a 429 Response if the limit is exceeded, null otherwise.
 * When Upstash is not configured the check is skipped and null is returned
 * so routes stay functional in local development.
 *
 * @param request     The incoming NextRequest (used to extract the client IP).
 * @param namespace   Unique string per endpoint, e.g. "support_ticket".
 * @param maxPerHour  Maximum allowed requests per IP per sliding hour window.
 */
export async function applyRateLimit(
  request: NextRequest,
  namespace: string,
  maxPerHour: number
): Promise<Response | null> {
  if (!redis) return null;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxPerHour, "1 h"),
    analytics: false,
    prefix: `eyra:rl:${namespace}`,
  });

  const ip = clientIp(request);

  let success: boolean;
  try {
    ({ success } = await limiter.limit(ip));
  } catch (err) {
    // Upstash being unreachable used to throw straight out of the route
    // handler, so every rate-limited endpoint answered 500 for the duration of
    // the outage, /api/razorpay/verify among them. That turns a blip in an
    // auxiliary service into failed payment verification and rejected
    // support tickets.
    //
    // Fail open instead: the limiter is a protective control, not a
    // correctness dependency, and this module already allows the request
    // through when Upstash is not configured at all. Failing closed only for
    // the configured-but-erroring case was the inconsistency, not the intent.
    console.error(
      `[rateLimit] Upstash check failed for namespace "${namespace}", allowing the request through:`,
      err
    );
    return null;
  }

  if (!success) {
    return Response.json(TOO_MANY_REQUESTS, { status: 429 });
  }

  return null;
}

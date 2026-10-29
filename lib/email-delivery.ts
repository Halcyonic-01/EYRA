/**
 * Decides whether an email is really sent, and to whom.
 *
 * Kept free of server-only code so the rules can be tested on their own.
 *
 *   EMAIL_MODE=live   send to the real recipient
 *   EMAIL_MODE=test   send only to EMAIL_TEST_RECIPIENT, subject marked [TEST]
 *   EMAIL_MODE=off    send nothing, only log
 *
 * With EMAIL_MODE unset, a production deployment is live and everything else
 * (local, Vercel preview) is test, so a developer's machine or a preview build
 * can never email a customer by accident.
 *
 * Promotional email has a second lock: in live mode it is sent only when
 * EMAIL_PROMOTIONS_ENABLED=true.
 */
export type EmailMode = "live" | "test" | "off";
export type EmailCategory = "transactional" | "promotional";

type Env = Record<string, string | undefined>;

const ADDRESS_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function resolveEmailMode(env: Env): EmailMode {
  const raw = env.EMAIL_MODE?.trim().toLowerCase();
  if (raw === "live" || raw === "test" || raw === "off") return raw;

  // Vercel sets NODE_ENV=production on preview builds too, so ask VERCEL_ENV first.
  const production = env.VERCEL_ENV ? env.VERCEL_ENV === "production" : env.NODE_ENV === "production";
  return production ? "live" : "test";
}

export type DeliveryPlan =
  | { action: "send"; mode: EmailMode; to: string; subject: string }
  | { action: "skip"; mode: EmailMode; reason: string };

export function planDelivery(
  params: { to: string; subject: string; category?: EmailCategory },
  env: Env
): DeliveryPlan {
  const mode = resolveEmailMode(env);

  if (mode === "off") {
    return { action: "skip", mode, reason: "EMAIL_MODE is off" };
  }

  if (mode === "test") {
    const tester = env.EMAIL_TEST_RECIPIENT?.trim();
    if (!tester || !ADDRESS_RE.test(tester)) {
      return { action: "skip", mode, reason: "test mode needs EMAIL_TEST_RECIPIENT" };
    }
    return { action: "send", mode, to: tester, subject: `[TEST for ${params.to}] ${params.subject}` };
  }

  if ((params.category ?? "transactional") === "promotional" && env.EMAIL_PROMOTIONS_ENABLED?.trim() !== "true") {
    return { action: "skip", mode, reason: "promotional email is off (EMAIL_PROMOTIONS_ENABLED is not true)" };
  }

  return { action: "send", mode, to: params.to, subject: params.subject };
}

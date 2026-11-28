/**
 * PostHog settings, from the environment only. Pure, so next.config, the
 * browser and the tests all read them the same way.
 *
 * Analytics is off unless NEXT_PUBLIC_POSTHOG_KEY holds a project token
 * (phc_…). A personal API key (phx_…) is a secret and is refused here, so it
 * can never be shipped to the browser by mistake.
 */

/**
 * Same-origin path the browser sends events to; next.config rewrites it to
 * PostHog. A neutral name, because blockers drop requests to "posthog",
 * "analytics" or "tracking" paths.
 */
export const ANALYTICS_PATH = "/ev";

export type AnalyticsRegion = "us" | "eu";

export interface AnalyticsConfig {
  key: string;
  region: AnalyticsRegion;
  /** PostHog's ingestion host, the rewrite's destination. */
  ingestHost: string;
  /** PostHog's static assets (the replay recorder), also behind the rewrite. */
  assetsHost: string;
  /** The PostHog app, for links from the toolbar. */
  uiHost: string;
  /** Session replay is allowed at all (the project's own replay settings still apply). */
  replay: boolean;
  debug: boolean;
}

export type AnalyticsEnv = {
  NEXT_PUBLIC_POSTHOG_KEY?: string;
  NEXT_PUBLIC_POSTHOG_HOST?: string;
  NEXT_PUBLIC_POSTHOG_REPLAY?: string;
  NEXT_PUBLIC_POSTHOG_DEBUG?: string;
};

const HOSTS: Record<string, AnalyticsRegion> = {
  "https://us.i.posthog.com": "us",
  "https://eu.i.posthog.com": "eu",
};

/** Null when analytics is off or the settings are not usable. */
export function analyticsConfig(env: AnalyticsEnv | Record<string, string | undefined>): AnalyticsConfig | null {
  const key = env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? "";
  if (!/^phc_[A-Za-z0-9]{10,}$/.test(key)) return null;
  const host = (env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com").replace(/\/+$/, "");
  const region = HOSTS[host];
  if (!region) return null;
  return {
    key,
    region,
    ingestHost: host,
    assetsHost: `https://${region}-assets.i.posthog.com`,
    uiHost: `https://${region}.posthog.com`,
    replay: env.NEXT_PUBLIC_POSTHOG_REPLAY?.trim().toLowerCase() === "true",
    debug: env.NEXT_PUBLIC_POSTHOG_DEBUG?.trim().toLowerCase() === "true",
  };
}

/** next.config rewrites for the proxy; none when analytics is off. Assets rules first, as PostHog requires. */
export function analyticsRewrites(config: AnalyticsConfig | null) {
  if (!config) return [];
  return [
    { source: `${ANALYTICS_PATH}/static/:path*`, destination: `${config.assetsHost}/static/:path*` },
    { source: `${ANALYTICS_PATH}/array/:path*`, destination: `${config.assetsHost}/array/:path*` },
    { source: `${ANALYTICS_PATH}/:path*`, destination: `${config.ingestHost}/:path*` },
  ];
}

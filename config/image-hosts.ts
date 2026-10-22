/**
 * Which remote hosts Next.js may fetch and resize images from.
 *
 * Next only optimises images from hosts it is told about, and every host here
 * is a place a stranger could point the optimiser at, so the list is short and
 * exact: EYRA's own domain, the local Medusa during development, and the
 * hostnames listed in MEDUSA_IMAGE_HOSTS (build-time env), which is where the
 * S3 bucket or its CDN goes. Wildcard hosts are never accepted.
 *
 *   MEDUSA_IMAGE_HOSTS=eyra-media.s3.ap-south-1.amazonaws.com
 *   MEDUSA_IMAGE_HOSTS=eyra-media.s3.ap-south-1.amazonaws.com,images.eyra.org.in
 */

export interface ImagePattern {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname: string;
}

/** A bare hostname: letters, digits, dots and hyphens, no wildcard, scheme, path or port. */
export function isExactHostname(value: string): boolean {
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(value);
}

export function imageRemotePatterns(env: Record<string, string | undefined>): ImagePattern[] {
  const patterns: ImagePattern[] = [
    // EYRA's own domain: seed products reference images by absolute URL here.
    { protocol: "https", hostname: "eyra.org.in", pathname: "/**" },
    { protocol: "https", hostname: "www.eyra.org.in", pathname: "/**" },
    // Medusa's local file storage, for development only. It serves /static.
    { protocol: "http", hostname: "localhost", port: "9000", pathname: "/static/**" },
  ];

  const listed = (env.MEDUSA_IMAGE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  for (const host of listed) {
    if (!isExactHostname(host)) {
      console.warn(`[next.config] Ignoring MEDUSA_IMAGE_HOSTS entry "${host}": use an exact hostname such as my-bucket.s3.ap-south-1.amazonaws.com.`);
      continue;
    }
    if (!patterns.some((pattern) => pattern.hostname === host)) {
      patterns.push({ protocol: "https", hostname: host, pathname: "/**" });
    }
  }
  return patterns;
}

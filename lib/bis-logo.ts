import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

const CANDIDATES = ["bis-hallmark.svg", "bis-hallmark.png", "bis-hallmark.webp", "bis-hallmark.jpg"];

/**
 * The official BIS Hallmark logo, if its file is in public/images (it is: the
 * file BIS publishes on bis.gov.in). The mark is Bureau of Indian Standards
 * property and is never redrawn here: the site shows only the real file, and shows
 * the registration number in words either way. Returns the public path, or null.
 */
export function bisLogoPath(): string | null {
  for (const name of CANDIDATES) {
    if (existsSync(path.join(process.cwd(), "public", "images", name))) return `/images/${name}`;
  }
  return null;
}

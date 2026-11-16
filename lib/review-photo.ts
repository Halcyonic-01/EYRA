/**
 * Server-only: turns a customer's photo into the one we store.
 *
 * The bytes must really be a JPEG, PNG, WebP or HEIC/HEIF image (whatever the
 * file is called). It is turned the right way up, shrunk to at most 1600px on
 * its long side and saved as WebP. Re-encoding drops all metadata, so the
 * phone's location, camera and owner details never reach our storage.
 */
import "server-only";

import sharp from "sharp";

import { REVIEW_LIMITS } from "@/lib/review-types";
import { sniffPhoto } from "@/lib/review-photo-check";

export type PreparedPhoto = { ok: true; base64: string; bytes: number } | { ok: false; error: string };

export async function preparePhoto(input: Buffer): Promise<PreparedPhoto> {
  if (input.length === 0) return { ok: false, error: "That photo is empty." };
  if (input.length > REVIEW_LIMITS.photoInputBytes) return { ok: false, error: "Please choose a photo under 10 MB." };
  if (!sniffPhoto(input)) return { ok: false, error: "Please choose a JPEG, PNG, WebP or HEIC photo." };
  try {
    const image = sharp(input, { limitInputPixels: 50_000_000, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height || meta.width < 100 || meta.height < 100) {
      return { ok: false, error: "That photo is too small. Please choose a larger one." };
    }
    const output = await image
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { ok: true, base64: output.toString("base64"), bytes: output.length };
  } catch {
    return { ok: false, error: "That photo could not be read. Please try another." };
  }
}

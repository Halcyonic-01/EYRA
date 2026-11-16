/** What an upload really is, from its first bytes. Free of server code so it can be tested. */
export type PhotoKind = "jpeg" | "png" | "webp" | "heic";

export function sniffPhoto(bytes: Uint8Array): PhotoKind | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "png";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  // ISO media: "ftyp" then a HEIF brand.
  if (bytes.length >= 12 && ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(ascii(8, 12))) return "heic";
  return null;
}

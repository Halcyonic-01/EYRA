/**
 * Turns a Medusa product type name into the words the site works with.
 *
 * The admin shows type names as people write them ("Rings", "Pendants"); the
 * site groups products by a small lower case set. Case and a plural "s" do not
 * matter, so a type added in the admin later needs no code change. Free of
 * server-only code so it can be tested on its own.
 */
export type UiProductType = "ring" | "pendant" | "bracelet" | "anklet";

// "chain" and "necklace" still resolve to pendant, so older Medusa type names keep working.
const UI_TYPES: Record<string, UiProductType> = {
  ring: "ring",
  pendant: "pendant",
  chain: "pendant",
  necklace: "pendant",
  bracelet: "bracelet",
  bangle: "bracelet",
  anklet: "anklet",
};

const singular = (raw: string | null | undefined): string => (raw ?? "").trim().toLowerCase().replace(/s$/, "");

/** The page grouping for a type name, or null when it is not one the site knows. */
export function canonicalProductType(raw: string | null | undefined): UiProductType | null {
  return UI_TYPES[singular(raw)] ?? null;
}

/** Necklaces and chains weigh like pendants, and bangles like bracelets; earrings and totes have their own weights. */
const SAME_WEIGHT_AS: Record<string, string> = {
  necklace: "pendant",
  chain: "pendant",
  bangle: "bracelet",
};

/** The key into the parcel weight table (config/storeConfig.ts) for a type name. */
export function weightKey(raw: string | null | undefined): string {
  const name = singular(raw);
  return SAME_WEIGHT_AS[name] ?? name;
}

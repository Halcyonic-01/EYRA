import { storeConfig } from "@/config/storeConfig";
import { weightKey } from "@/lib/product-type";

/**
 * Estimated weight of one piece, in kg, from its product type. Shipments and
 * return pickups both use this, so the same item weighs the same either way.
 * An unknown or missing type falls back to the default item weight.
 */
export function itemWeightKg(type: string | null | undefined): number {
  const { itemWeightsG, defaultItemWeightG } = storeConfig.shipping;
  return (itemWeightsG[weightKey(type)] ?? defaultItemWeightG) / 1000;
}

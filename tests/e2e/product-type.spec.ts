import { test, expect } from "@playwright/test";
import { canonicalProductType, weightKey } from "../../lib/product-type";

// The product type names in the production admin are "Rings", "Pendants",
// "Anklets" and "Bracelets". The site must group and weigh them correctly.

test.describe("product type to page grouping", () => {
  test("the production admin's names map to the site's groups", () => {
    expect(canonicalProductType("Rings")).toBe("ring");
    expect(canonicalProductType("Pendants")).toBe("chain");
    expect(canonicalProductType("Anklets")).toBe("anklet");
    expect(canonicalProductType("Bracelets")).toBe("bracelet");
  });

  test("the lower case single words used before still work", () => {
    for (const name of ["ring", "chain", "bracelet", "anklet"] as const) {
      expect(canonicalProductType(name)).toBe(name);
    }
  });

  test("case, spaces and plurals do not matter", () => {
    expect(canonicalProductType("  RING ")).toBe("ring");
    expect(canonicalProductType("Chains")).toBe("chain");
    expect(canonicalProductType("Necklaces")).toBe("chain");
    expect(canonicalProductType("Bangles")).toBe("bracelet");
  });

  test("a type the site does not know, or none at all, is not guessed here", () => {
    expect(canonicalProductType("Brooches")).toBeNull();
    expect(canonicalProductType("")).toBeNull();
    expect(canonicalProductType(null)).toBeNull();
    expect(canonicalProductType(undefined)).toBeNull();
  });
});

test.describe("product type to parcel weight key", () => {
  test("matches the keys of the weight table", () => {
    expect(weightKey("Rings")).toBe("ring");
    expect(weightKey("Pendants")).toBe("pendant");
    expect(weightKey("Anklets")).toBe("anklet");
    expect(weightKey("Bracelets")).toBe("bracelet");
    expect(weightKey("Earrings")).toBe("earring");
  });

  test("the keys the backend sends and the complimentary tote pass through unchanged", () => {
    for (const key of ["ring", "chain", "bracelet", "anklet", "pendant", "earring", "tote"]) {
      expect(weightKey(key)).toBe(key);
    }
  });

  test("necklaces weigh like chains and bangles like bracelets", () => {
    expect(weightKey("Necklaces")).toBe("chain");
    expect(weightKey("Bangles")).toBe("bracelet");
  });
});

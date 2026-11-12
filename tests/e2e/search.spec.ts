import { test, expect } from "@playwright/test";
import type { Product } from "../../components/products/types";
import { buildSearchIndex, editDistance, searchProducts } from "../../lib/search";

// The product search engine, on a catalogue shaped like the real one. Pure
// logic: no server needed.

const STERLING = ["925 Sterling", "Hallmarked", "Anti-tarnish"];

function product(name: string, over: Partial<Product> = {}): Product {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    price: 2000,
    originalPrice: 3200,
    description: "",
    images: [],
    inStock: 10,
    type: "ring",
    audiences: [],
    tags: STERLING,
    categories: [],
    collections: [],
    ...over,
  };
}

const CATALOGUE: Product[] = [
  product("Eyra Signature Silver Ring", { description: "Crafted in premium 925 sterling silver with a sleek minimal finish.", typeLabel: "ring", audiences: ["women"], categories: ["WOMEN"] }),
  product("Celestial Band Ring", { description: "Delicately textured band in 925 sterling silver, perfect for everyday stacking.", typeLabel: "ring" }),
  product("Sovereign Signet Ring", { description: "A heavy-gauge signet ring in pure 925 sterling silver.", typeLabel: "ring", audiences: ["men"], categories: ["MEN"] }),
  product("Serpentine Silver Chain", { type: "pendant", typeLabel: "chain", tags: [...STERLING, "Nickel Free"], description: "A bold serpentine-link chain in 925 sterling silver." }),
  product("Rope Twist Chain", { type: "pendant", typeLabel: "chain", tags: [...STERLING, "Nickel Free"], description: "Classic rope-twist link chain in 925 sterling silver." }),
  product("Box Link Statement Chain", { type: "pendant", typeLabel: "chain", tags: [...STERLING, "Nickel Free"], description: "Chunky box-link chain in heavyweight 925 sterling silver." }),
  product("Luna Anklet", { type: "anklet", typeLabel: "anklet", tags: [], description: "A delicate 925 sterling silver anklet. Wear one, or take the pair.", audiences: ["women"] }),
  product("Moonstone Pendant", { type: "pendant", typeLabel: "pendant", tags: [], description: "A moonstone pendant in 925 sterling silver." }),
  product("Cuban Link Bracelet", { type: "bracelet", typeLabel: "bracelet", description: "A solid cuban link bracelet.", collections: ["Wedding Edit"] }),
  product("Eternity Stacking Ring", { description: "A slim eternity band set with cubic zirconia.", typeLabel: "ring", audiences: ["couple"], categories: ["COUPLE"] }),
];

const index = buildSearchIndex(CATALOGUE);
const names = (query: string) => searchProducts(index, query).products.map((p) => p.name);

test.describe("product search", () => {
  test("partial words match the start of a word", () => {
    expect(names("ank")[0]).toBe("Luna Anklet");
    expect(names("sig")[0]).toBe("Sovereign Signet Ring");
    expect(names("serp")).toEqual(["Serpentine Silver Chain"]);
  });

  test("plural and capitals don't matter", () => {
    const rings = names("RINGS");
    expect(rings.length).toBe(4);
    for (const name of rings) expect(name).toMatch(/Ring$/);
  });

  test("a word that matches is never 'corrected' into another product", () => {
    // "ring" is one edit from "king" and others; only real rings come back.
    const result = searchProducts(index, "ring");
    expect(result.mode).toBe("exact");
    for (const p of result.products) expect(p.type).toBe("ring");
  });

  test("tags are searched", () => {
    const nickelFree = names("nickel free");
    expect(nickelFree.sort()).toEqual(["Box Link Statement Chain", "Rope Twist Chain", "Serpentine Silver Chain"]);
    expect(names("anti tarnish")).not.toContain("Luna Anklet");
  });

  test("categories are searched", () => {
    expect(names("couple")[0]).toBe("Eternity Stacking Ring");
    expect(names("men")[0]).toBe("Sovereign Signet Ring");
  });

  test("collections are searched, both Medusa's and the storefront's", () => {
    expect(names("wedding")).toEqual(["Cuban Link Bracelet"]);
    // "For Her" is a storefront collection of women's and couple pieces.
    const forHer = names("for her");
    expect(forHer).toEqual(expect.arrayContaining(["Eyra Signature Silver Ring", "Luna Anklet", "Eternity Stacking Ring"]));
    expect(forHer).not.toContain("Sovereign Signet Ring");
  });

  test("the product type as named in Medusa is searched (chains are listed as pendants)", () => {
    expect(names("chain").sort()).toEqual(["Box Link Statement Chain", "Rope Twist Chain", "Serpentine Silver Chain"]);
    // A pendant by name comes before chains that are only pendants by type.
    expect(names("pendant")[0]).toBe("Moonstone Pendant");
  });

  test("typos are corrected and the corrected query is reported", () => {
    const ring = searchProducts(index, "rnig");
    expect(ring.mode).toBe("corrected");
    expect(ring.correctedQuery).toBe("ring");
    for (const p of ring.products) expect(p.type).toBe("ring");

    expect(names("ankelt")).toEqual(["Luna Anklet"]);
    expect(names("pendnat")[0]).toBe("Moonstone Pendant");
    expect(names("brcelet")).toEqual(["Cuban Link Bracelet"]);
    expect(names("serpantine")).toEqual(["Serpentine Silver Chain"]);
    expect(names("silvr ring")[0]).toBe("Eyra Signature Silver Ring");
  });

  test("short words are not corrected into unrelated ones", () => {
    // "gold" is one letter from "bold" (a word in a description), which would be wrong.
    const gold = searchProducts(index, "gold");
    expect(gold.mode).toBe("closest");
    expect(gold.unmatched).toEqual(["gold"]);
  });

  test("synonyms and other ways of saying it", () => {
    expect(names("necklace").sort()).toEqual(["Box Link Statement Chain", "Rope Twist Chain", "Serpentine Silver Chain"]);
    expect(names("payal")).toEqual(["Luna Anklet"]);
    expect(names("kada")).toEqual(["Cuban Link Bracelet"]);
    expect(names("locket")[0]).toBe("Moonstone Pendant");
    // "band" finds the band ring first, then the other rings.
    const band = names("band");
    expect(band[0]).toBe("Celestial Band Ring");
    expect(band).toContain("Sovereign Signet Ring");
    // A misspelt synonym still works.
    expect(names("neklace")).toContain("Rope Twist Chain");
  });

  test("relevance: an exact name comes first, then products matching every word", () => {
    expect(names("rope twist chain")[0]).toBe("Rope Twist Chain");
    expect(names("celestial band ring")[0]).toBe("Celestial Band Ring");
    // Both words in the name beats one in the name and one in the description.
    expect(names("silver ring")[0]).toBe("Eyra Signature Silver Ring");
    // A name match beats a description match.
    expect(names("moonstone")).toEqual(["Moonstone Pendant"]);
  });

  test("when products match every word, only those are shown", () => {
    expect(names("silver anklet")).toEqual(["Luna Anklet"]);
    // "Chunky" is in the Box Link description; "bold", a synonym, is in the Serpentine one.
    const chunky = names("chunky chain");
    expect(chunky[0]).toBe("Box Link Statement Chain");
    expect(chunky).not.toContain("Rope Twist Chain");
  });

  test("everyday phrasing: filler words are ignored", () => {
    expect(names("show me a ring")).toEqual(names("ring"));
    expect(names("silver jewellery for my wife")).toEqual(expect.arrayContaining(["Eyra Signature Silver Ring", "Luna Anklet"]));
  });

  test("no product matches every word: the ones matching some come back, marked partial", () => {
    const result = searchProducts(index, "gift for wife");
    expect(result.mode).toBe("partial");
    expect(result.unmatched).toEqual(["gift"]);
    expect(result.products.length).toBeGreaterThan(0);
    // "For Her" holds women's and couple pieces.
    for (const p of result.products) expect(["women", "couple"]).toContain(p.audiences?.[0]);
  });

  test("zero exact matches: the closest products, never an empty list", () => {
    const nonsense = searchProducts(index, "zzzzqqq");
    expect(nonsense.mode).toBe("closest");
    expect(nonsense.products.length).toBeGreaterThan(0);
    expect(nonsense.products.length).toBeLessThanOrEqual(8);

    const close = searchProducts(index, "lunaa ankelette");
    expect(close.products[0].name).toBe("Luna Anklet");
  });

  test("an empty query returns the whole catalogue in order", () => {
    expect(names("   ")).toEqual(CATALOGUE.map((p) => p.name));
  });

  test("fast enough to search on every key press", () => {
    const big = Array.from({ length: 100 }, (_, i) => product(`${CATALOGUE[i % CATALOGUE.length].name} ${i}`, CATALOGUE[i % CATALOGUE.length]));
    const bigIndex = buildSearchIndex(big);
    const queries = ["r", "ri", "rin", "ring", "rnig", "silver ring", "necklace", "zzzz", "for her", "ankelt"];
    const started = performance.now();
    for (let i = 0; i < 20; i++) for (const q of queries) searchProducts(bigIndex, q);
    const perSearch = (performance.now() - started) / (20 * queries.length);
    expect(perSearch).toBeLessThan(15);
  });

  test("edit distance counts a swap of neighbours as one edit", () => {
    expect(editDistance("rnig", "ring")).toBe(1);
    expect(editDistance("anklet", "anklet")).toBe(0);
    expect(editDistance("brcelet", "bracelet")).toBe(1);
  });
});

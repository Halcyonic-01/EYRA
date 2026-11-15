import { test, expect } from "@playwright/test";
import { rankSimilar } from "../../lib/similar-products";
import type { Audience, Product } from "../../components/products/types";

// Pure logic: no browser or backend needed.

function piece(id: string, type: Product["type"], audiences: Audience[], price = 2000): Product {
  return { id, name: id, price, originalPrice: price * 2, description: "", images: [], inStock: 5, type, audiences };
}

const shop = [
  piece("w-ring-1", "ring", ["women"]),
  piece("m-ring-1", "ring", ["men"]),
  piece("w-chain", "pendant", ["women"]),
  piece("m-chain", "pendant", ["men"]),
  piece("couple-ring", "ring", ["couple"]),
  piece("plain-ring", "ring", []),
  piece("m-ring-2", "ring", ["men"], 2600),
  piece("m-ring-3", "ring", ["men"], 2100),
  piece("w-ring-2", "ring", ["women"], 1900),
];
const ids = (list: Product[]) => list.map((p) => p.id);

test.describe("similar products", () => {
  test("a men's ring leads with men's rings, nearest price first, and never with women's", () => {
    const current = shop.find((p) => p.id === "m-ring-1")!;
    const out = ids(rankSimilar(current, shop, 20));
    expect(out.slice(0, 2)).toEqual(["m-ring-3", "m-ring-2"]);
    // Other designs for men come before anything for women.
    const firstWomen = Math.min(out.indexOf("w-ring-1"), out.indexOf("w-chain"), out.indexOf("w-ring-2"));
    expect(out.indexOf("m-chain")).toBeLessThan(firstWomen);
    expect(out.indexOf("couple-ring")).toBeLessThan(firstWomen);
    expect(out.indexOf("plain-ring")).toBeLessThan(firstWomen);
  });

  test("a women's ring leads with women's rings, and men's pieces come last", () => {
    const current = shop.find((p) => p.id === "w-ring-1")!;
    const out = ids(rankSimilar(current, shop, 20));
    expect(out[0]).toBe("w-ring-2");
    const lastNonMen = Math.max(...["w-ring-2", "w-chain", "couple-ring", "plain-ring"].map((id) => out.indexOf(id)));
    for (const id of ["m-ring-1", "m-ring-2", "m-ring-3", "m-chain"]) expect(out.indexOf(id)).toBeGreaterThan(lastNonMen);
  });

  test("the order is same type and gender, same type for anyone, other type and gender, other type for anyone", () => {
    const current = shop.find((p) => p.id === "m-ring-1")!;
    expect(ids(rankSimilar(current, shop, 20))).toEqual([
      "m-ring-3", "m-ring-2", // same type, same gender
      "couple-ring", "plain-ring", // same type, suits anyone
      "m-chain", // other type, same gender
      "w-ring-1", "w-ring-2", // same type, other gender
      "w-chain", // other type, other gender
    ]);
  });

  test("the product itself is left out and the limit is respected", () => {
    const current = shop.find((p) => p.id === "m-ring-1")!;
    expect(ids(rankSimilar(current, shop, 3))).toHaveLength(3);
    expect(ids(rankSimilar(current, shop, 20))).not.toContain("m-ring-1");
  });

  test("a couple or unset product has no gender to favour: only the type decides", () => {
    for (const id of ["couple-ring", "plain-ring"]) {
      const current = shop.find((p) => p.id === id)!;
      const out = rankSimilar(current, shop, 20);
      const ringCount = shop.filter((p) => p.type === "ring" && p.id !== id).length;
      expect(out.slice(0, ringCount).every((p) => p.type === "ring")).toBe(true);
    }
  });

  test("a piece listed for both genders is a match for either", () => {
    const unisex = piece("unisex-ring", "ring", ["men", "women"]);
    const out = ids(rankSimilar(shop.find((p) => p.id === "m-ring-1")!, [...shop, unisex], 20));
    expect(out.indexOf("unisex-ring")).toBeLessThan(out.indexOf("couple-ring"));
  });
});

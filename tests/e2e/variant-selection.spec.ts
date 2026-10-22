import { test, expect } from "@playwright/test";
import {
  candidateVariants,
  choiceOptions,
  defaultSelection,
  resolveVariant,
} from "../../lib/variant-selection";
import type { ProductVariant } from "../../components/products/types";

// Choosing a variant is pure logic over what Medusa returned, so it runs
// without a browser. Prices below are as Medusa would hold them.

const variant = (id: string, options: Record<string, string>, price: number, inStock = 10): ProductVariant => ({
  id,
  title: id,
  price,
  originalPrice: Math.round(price * 1.6),
  inStock,
  options,
});

// An anklet: the pair is 1.9 times the single.
const anklet = [
  variant("single", { Pack: "Single" }, 2000),
  variant("pair", { Pack: "Pair" }, 3800),
];
const ankletChoices = [{ title: "Pack", values: ["Single", "Pair"] }];

// A pendant, with an optional chain that adds 1,000.
const pendant = [
  variant("plain", { Chain: "Pendant only" }, 1800),
  variant("chain", { Chain: "With silver chain" }, 2800),
];
const pendantChoices = [{ title: "Chain", values: ["Pendant only", "With silver chain"] }];

// A ring has a size option and nothing else.
const ring = ["12", "13", "14"].map((size) => variant(`ring-${size}`, { Size: size }, 2499));

test.describe("choosing a variant", () => {
  test("opens on the cheapest option", () => {
    expect(defaultSelection(anklet, ankletChoices)).toEqual({ Pack: "Single" });
    expect(defaultSelection(pendant, pendantChoices)).toEqual({ Chain: "Pendant only" });
  });

  test("single and pair each sell at their own price", () => {
    expect(resolveVariant(anklet, { Pack: "Single" }, undefined, null).variant?.id).toBe("single");
    expect(resolveVariant(anklet, { Pack: "Single" }, undefined, null).price).toBe(2000);
    expect(resolveVariant(anklet, { Pack: "Pair" }, undefined, null).variant?.id).toBe("pair");
    expect(resolveVariant(anklet, { Pack: "Pair" }, undefined, null).price).toBe(3800);
  });

  test("the pair price is Medusa's, not a rule in the storefront", () => {
    const other = [variant("s", { Pack: "Single" }, 1500), variant("p", { Pack: "Pair" }, 2850)];
    expect(resolveVariant(other, { Pack: "Pair" }, undefined, null).price).toBe(2850);
    expect(resolveVariant(other, { Pack: "Pair" }, undefined, null).price).not.toBe(2 * 1500);
  });

  test("a pendant with a chain costs the chain extra, as priced in Medusa", () => {
    const plain = resolveVariant(pendant, { Chain: "Pendant only" }, undefined, null);
    const chain = resolveVariant(pendant, { Chain: "With silver chain" }, undefined, null);
    expect(chain.price - plain.price).toBe(1000);
  });

  test("switching the choice switches the variant", () => {
    let sel = defaultSelection(anklet, ankletChoices);
    expect(resolveVariant(anklet, sel, undefined, null).variant?.id).toBe("single");
    sel = { ...sel, Pack: "Pair" };
    expect(resolveVariant(anklet, sel, undefined, null).variant?.id).toBe("pair");
    sel = { ...sel, Pack: "Single" };
    expect(resolveVariant(anklet, sel, undefined, null).variant?.id).toBe("single");
  });

  test("an option value that does not exist matches nothing", () => {
    expect(candidateVariants(anklet, { Pack: "Triple" })).toHaveLength(0);
  });

  test("a ring needs a size before it is one variant", () => {
    const unsized = resolveVariant(ring, {}, "Size", null);
    expect(unsized.needsSize).toBe(true);
    expect(unsized.variant).toBeNull();
    expect(unsized.price).toBe(2499);

    const sized = resolveVariant(ring, {}, "Size", 13);
    expect(sized.needsSize).toBe(false);
    expect(sized.variant?.id).toBe("ring-13");
  });

  test("shows what each value costs and whether it is in stock", () => {
    const stocked = [variant("s", { Pack: "Single" }, 2000, 5), variant("p", { Pack: "Pair" }, 3800, 0)];
    const options = choiceOptions(stocked, ankletChoices[0], { Pack: "Single" }, undefined, null);
    expect(options).toEqual([
      { value: "Single", price: 2000, inStock: true },
      { value: "Pair", price: 3800, inStock: false },
    ]);
  });

  test("works out per-value prices for a ring product that also has a pack choice", () => {
    const both = [
      variant("a", { Size: "12", Pack: "Single" }, 2000),
      variant("b", { Size: "12", Pack: "Pair" }, 3800),
      variant("c", { Size: "13", Pack: "Single" }, 2000),
      variant("d", { Size: "13", Pack: "Pair" }, 3800),
    ];
    const choices = [{ title: "Pack", values: ["Single", "Pair"] }];
    expect(resolveVariant(both, { Pack: "Pair" }, "Size", 13).variant?.id).toBe("d");
    expect(choiceOptions(both, choices[0], { Pack: "Single" }, "Size", 12).map((o) => o.price)).toEqual([2000, 3800]);
  });
});

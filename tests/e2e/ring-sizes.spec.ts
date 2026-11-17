import { test, expect } from "@playwright/test";
import { limitRingSizes, SIZE_CHART } from "../../lib/sizing";

// Pure logic: no browser or backend needed.

const ALL = Array.from({ length: 15 }, (_, i) => String(6 + i)); // 6..20, as seeded

test.describe("ring sizes on sale", () => {
  test("a women's ring is offered in 10, 12 and 14 only", () => {
    expect(limitRingSizes(ALL, "ring", ["women"])).toEqual(["10", "12", "14"]);
  });

  test("a men's ring is offered in 18, 20 and 22 only, and only those that exist", () => {
    expect(limitRingSizes([...ALL, "21", "22"], "ring", ["men"])).toEqual(["18", "20", "22"]);
    // Size 22 is not made yet: the list shows what exists, never an invented size.
    expect(limitRingSizes(ALL, "ring", ["men"])).toEqual(["18", "20"]);
  });

  test("the order the shop gives is kept, and the input list is not changed", () => {
    const given = ["14", "10", "12"];
    expect(limitRingSizes(given, "ring", ["women"])).toEqual(["14", "10", "12"]);
    expect(given).toEqual(["14", "10", "12"]);
  });

  test("everything else is left exactly as it is", () => {
    expect(limitRingSizes(ALL, "ring", undefined)).toEqual(ALL);
    expect(limitRingSizes(ALL, "ring", [])).toEqual(ALL);
    expect(limitRingSizes(ALL, "ring", ["couple"])).toEqual(ALL);
    expect(limitRingSizes(ALL, "ring", ["men", "women"])).toEqual(ALL);
    expect(limitRingSizes(["Small", "Large"], "pendant", ["women"])).toEqual(["Small", "Large"]);
    expect(limitRingSizes(["1"], "anklet", ["men"])).toEqual(["1"]);
  });

  test("a ring that would be left with no size keeps its own", () => {
    expect(limitRingSizes(["6", "7"], "ring", ["women"])).toEqual(["6", "7"]);
  });

  test("the size chart guide still runs 6 to 24", () => {
    expect(SIZE_CHART[0].size).toBe(6);
    expect(SIZE_CHART.at(-1)?.size).toBe(24);
    expect(SIZE_CHART).toHaveLength(19);
  });
});

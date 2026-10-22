import { test, expect } from "@playwright/test";
import { ORDERED_STEPS, recordedStatusNote, recordedStep } from "../../lib/tracking-steps";

// The tracking bar normally follows the courier's feed. When that feed has
// nothing (the courier is down, or this is a test setup), the order's own
// recorded status keeps the bar and the words honest.

const delivered = ORDERED_STEPS.length - 1;

test.describe("tracking bar from the order's recorded status", () => {
  test("a delivered order is at the last step, not at Order Placed", () => {
    expect(recordedStep("DELIVERED")).toBe(delivered);
    expect(recordedStep("delivered")).toBe(delivered);
  });

  test("in-between statuses land on their own step", () => {
    expect(ORDERED_STEPS[recordedStep("OUT FOR DELIVERY")].label).toBe("Out for Delivery");
    expect(ORDERED_STEPS[recordedStep("PICKED UP")].label).toBe("Picked Up");
  });

  test("a parcel coming back is never shown as delivered", () => {
    expect(recordedStep("RTO DELIVERED")).toBe(0);
    expect(recordedStep("RTO INITIATED")).toBe(0);
  });

  test("no status leaves the bar at the start", () => {
    expect(recordedStep(null)).toBe(0);
    expect(recordedStep("")).toBe(0);
  });
});

test.describe("what is said when the courier's feed is empty", () => {
  test("says when it was delivered", () => {
    expect(recordedStatusNote("DELIVERED", "2026-10-23T02:53:37.000Z")).toBe("Delivered on 23 Oct 2026.");
  });

  test("says a returned parcel came back to us", () => {
    expect(recordedStatusNote("RTO DELIVERED", "2026-10-23T02:53:37.000Z")).toBe("The parcel was returned to us on 23 Oct 2026.");
    expect(recordedStatusNote("RTO INITIATED", "2026-10-23T02:53:37.000Z")).toBe("The parcel is on its way back to us (since 23 Oct 2026).");
  });

  test("keeps the usual waiting text when nothing is known", () => {
    expect(recordedStatusNote(null, null)).toBeNull();
    expect(recordedStatusNote("NEW", "2026-10-23T02:53:37.000Z")).toBeNull();
  });

  test("copes with a missing date", () => {
    expect(recordedStatusNote("DELIVERED", undefined)).toBe("Delivered.");
  });
});

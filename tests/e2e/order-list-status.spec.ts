import { test, expect } from "@playwright/test";
import { orderListStatus } from "../../lib/order-list-status";

// What the My Orders list says, from the courier status the order records.

const placed = { status: "pending", fulfillment_status: "not_fulfilled" };

test.describe("my orders list status", () => {
  test("an order not yet shipped says Processing", () => {
    expect(orderListStatus({ ...placed, metadata: null })).toEqual({
      badge: "pending",
      progress: { label: "Processing", done: false },
    });
  });

  test("a delivered order is Completed and Delivered, even though Medusa still says not fulfilled", () => {
    const view = orderListStatus({ ...placed, metadata: { shiprocket_status: "DELIVERED", dispatch_state: "shipped" } });
    expect(view).toEqual({ badge: "completed", progress: { label: "Delivered", done: true } });
  });

  test("in-between courier statuses show their own step", () => {
    expect(orderListStatus({ ...placed, metadata: { shiprocket_status: "OUT FOR DELIVERY" } }).progress).toEqual({
      label: "Out for Delivery",
      done: true,
    });
    expect(orderListStatus({ ...placed, metadata: { shiprocket_status: "PICKED UP" } }).progress?.label).toBe("Picked Up");
  });

  test("shipped with no courier update yet says Shipped", () => {
    expect(orderListStatus({ ...placed, metadata: { dispatch_state: "shipped" } }).progress).toEqual({
      label: "Shipped",
      done: true,
    });
  });

  test("a parcel coming back is never shown as delivered", () => {
    expect(orderListStatus({ ...placed, metadata: { shiprocket_status: "RTO INITIATED" } })).toEqual({
      badge: "pending",
      progress: { label: "Returning to us", done: false },
    });
    expect(orderListStatus({ ...placed, metadata: { shiprocket_status: "RTO DELIVERED" } }).progress?.label).toBe("Returned to us");
  });

  test("a cancelled order is Cancelled whichever way it is spelled, with no progress line", () => {
    for (const status of ["canceled", "cancelled"]) {
      expect(orderListStatus({ status, fulfillment_status: "not_fulfilled", metadata: null })).toEqual({
        badge: "canceled",
        progress: null,
      });
    }
    expect(orderListStatus({ status: "pending", fulfillment_status: "canceled", metadata: { shiprocket_status: "DELIVERED" } }).badge).toBe("canceled");
  });

  test("falls back to Medusa's own fulfilment when the order records nothing", () => {
    expect(orderListStatus({ status: "completed", fulfillment_status: "delivered", metadata: {} })).toEqual({
      badge: "completed",
      progress: { label: "Delivered", done: true },
    });
  });
});

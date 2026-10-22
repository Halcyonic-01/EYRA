import { test, expect } from "@playwright/test";
import { totalAfterWallet, walletCreditOf } from "../../lib/order-credit";

// Medusa adds its own credit line when staff cancel an order in the admin. It
// must not be shown to the customer as wallet credit.

test.describe("wallet credit on an order", () => {
  test("an order paid with wallet credit shows it, and the total is net of it", () => {
    const order = { total: 1000, credit_line_total: 2000, credit_lines: [{ reference: "wallet", amount: 2000 }] };
    expect(walletCreditOf(order)).toBe(2000);
    expect(totalAfterWallet(order)).toBe(1000);
  });

  test("a credit line Medusa made when the order was cancelled is not wallet credit", () => {
    // The Rs 5,098 order cancelled in the admin: Medusa records a credit line and its total drops to 0.
    const order = { total: 0, credit_line_total: 5098, credit_lines: [{ reference: "payment_collection", amount: 5098 }] };
    expect(walletCreditOf(order)).toBe(0);
    expect(totalAfterWallet(order)).toBe(5098);
  });

  test("both kinds on one order are told apart", () => {
    const order = {
      total: 0,
      credit_line_total: 1500,
      credit_lines: [
        { reference: "wallet", amount: 500 },
        { reference: "payment_collection", amount: 1000 },
      ],
    };
    expect(walletCreditOf(order)).toBe(500);
    expect(totalAfterWallet(order)).toBe(1000);
  });

  test("an order with no credit lines is unchanged", () => {
    expect(walletCreditOf({ credit_line_total: 0, credit_lines: [] })).toBe(0);
    expect(totalAfterWallet({ total: 3049, credit_line_total: 0, credit_lines: [] })).toBe(3049);
  });

  test("without the lines, every credit line counts as before", () => {
    expect(walletCreditOf({ credit_line_total: 500 })).toBe(500);
    expect(totalAfterWallet({ total: 2549, credit_line_total: 500 })).toBe(2549);
  });

  test("amounts that arrive as text are read", () => {
    expect(walletCreditOf({ credit_lines: [{ reference: "wallet", amount: "250.5" }] })).toBe(250.5);
  });
});

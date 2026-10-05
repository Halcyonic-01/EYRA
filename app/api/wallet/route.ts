import { NextRequest, NextResponse } from "next/server";

import { getWallet } from "@/lib/medusa-wallet";
import { getWalletCustomer } from "@/lib/wallet-customer";

/**
 * The signed-in customer's wallet balance and history.
 * With `?summary=1`: just the balance and next expiry, for the header.
 */
export async function GET(req: NextRequest) {
  const summary = req.nextUrl.searchParams.get("summary") === "1";

  const customer = await getWalletCustomer();
  if (!customer) {
    // Guests simply have no wallet; checkout shows nothing for them.
    return NextResponse.json({ signedIn: false, balance: 0, nextExpiry: null, transactions: [] });
  }

  const wallet = await getWallet(customer.customerId, summary ? 1 : 50);
  if (!wallet) {
    return NextResponse.json(
      { signedIn: true, error: "wallet_unavailable", balance: 0, nextExpiry: null, transactions: [] },
      { status: 502 }
    );
  }

  if (summary) {
    return NextResponse.json({
      signedIn: true,
      balance: wallet.balance,
      nextExpiry: wallet.nextExpiry,
    });
  }

  return NextResponse.json({ signedIn: true, ...wallet });
}

import { NextResponse } from "next/server";

import { getExchangeOptions } from "@/lib/medusa";
import { getWalletCustomer } from "@/lib/wallet-customer";

/** The sizes and designs an exchange can be for, for the signed-in customer's request form. */
export async function GET() {
  const customer = await getWalletCustomer();
  if (!customer) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  return NextResponse.json({ options: await getExchangeOptions() });
}

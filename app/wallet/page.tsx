import type { Metadata } from "next";

import { WalletView } from "@/components/wallet/WalletView";
import { getWallet } from "@/lib/medusa-wallet";
import { getWalletCustomer } from "@/lib/wallet-customer";
import { storeConfig } from "@/config/storeConfig";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Your EYRA store credit from returns and exchanges.",
};

// The balance changes whenever credit is issued or spent, so never cache it.
export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const customer = await getWalletCustomer();
  const wallet = customer ? await getWallet(customer.customerId) : null;

  return (
    <WalletView
      balance={wallet?.balance ?? 0}
      nextExpiry={wallet?.nextExpiry ?? null}
      validityMonths={storeConfig.policy.walletCreditMonths}
      transactions={wallet?.transactions ?? []}
      // A signed-in customer who is not in Medusa yet has simply never had credit.
      loadFailed={customer !== null && wallet === null}
    />
  );
}

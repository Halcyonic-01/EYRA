import Link from "next/link";
import { Wallet } from "lucide-react";

import { formatRupees } from "@/lib/money";

/** The wallet balance in the header, linking to the wallet page. */
export function WalletChip({
  balance,
  hint,
  dark,
}: {
  balance: number;
  /** Tooltip, for example when the credit expires. */
  hint: string;
  /** True on the dark header, so it reads on charcoal. */
  dark: boolean;
}) {
  return (
    <Link
      href="/wallet"
      aria-label={`Wallet: ${formatRupees(balance)} available`}
      title={hint}
      className={[
        "hidden sm:inline-flex items-center gap-1.5 mr-1 px-3 py-1.5 rounded-full border text-[0.72rem] font-sans font-medium transition-colors duration-200",
        dark
          ? "border-white/30 text-pearl hover:text-white hover:border-white"
          : "border-[#CFCFCF] text-[#333] hover:text-black hover:border-black",
      ].join(" ")}
    >
      <Wallet size={13} strokeWidth={1.6} aria-hidden="true" />
      {formatRupees(balance)}
    </Link>
  );
}

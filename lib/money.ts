/**
 * Rupees for display. Whole amounts have no decimals (₹1,500); an amount with
 * paise keeps them (₹1,500.50) so a wallet balance is never shown rounded.
 */
export function formatRupees(amount: number): string {
  const hasPaise = Math.abs(amount - Math.round(amount)) > 0.001;
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

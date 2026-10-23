import { TOTE_MIN_SUBTOTAL, qualifiesForTote, rupees, toteShortfall } from "@/config/offers";

/**
 * The complimentary tote bag, as the customer reads about it. The backend adds
 * the tote to the order as a free line while the items are worth more than
 * ₹1,499 and it is in stock; this only says so. `itemsSubtotal` is the price of
 * the items before any discount, without shipping, and an order qualifies only
 * when it is strictly above the threshold. `inCart` is whether the backend has
 * put the tote in the cart: an order that qualifies without one has run out of
 * stock, since the tote is subject to availability.
 */
export function ToteOffer({
  itemsSubtotal,
  inCart,
  className = "",
}: {
  itemsSubtotal: number;
  inCart: boolean;
  className?: string;
}) {
  if (itemsSubtotal <= 0) return null;

  if (qualifiesForTote(itemsSubtotal)) {
    return (
      <p
        role="status"
        className={`rounded-xl border border-dashed border-[#47B10A] bg-[#F6FBF2] px-4 py-3 font-sans text-[13px] text-[#3D7A1A] ${className}`}
      >
        {inCart
          ? "A complimentary EYRA tote bag is included with this order."
          : "This order qualifies for a complimentary EYRA tote bag, subject to stock availability."}
      </p>
    );
  }

  return (
    <p className={`rounded-xl bg-[#F7F7F7] px-4 py-3 font-sans text-[13px] text-[#626262] ${className}`}>
      Add {rupees(toteShortfall(itemsSubtotal))} more to get a complimentary EYRA tote bag on orders above{" "}
      {rupees(TOTE_MIN_SUBTOTAL)}.
    </p>
  );
}

/** The tote as a line in a list of items: free, and not for the customer to change. */
export function ToteLine({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div>
        <p className="font-sans font-normal text-[15px] text-black">EYRA tote bag</p>
        <p className="font-sans text-[12px] text-[#909090]">Complimentary · Qty: 1</p>
      </div>
      <span className="font-sans font-medium text-[15px]" style={{ color: "#47B10A" }}>
        Free
      </span>
    </div>
  );
}

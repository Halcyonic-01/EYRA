import { PDP_POLICY_BADGE } from "@/config/policy-copy";

/**
 * The return policy, in one line, on every product page, shown under the
 * Buy now and Add to cart buttons. The text is fixed wording.
 */
export function PolicyBadge() {
  return (
    <p
      data-testid="policy-badge"
      className="rounded-full border border-[#E1E1E1] bg-white px-4 py-2 text-center font-sans text-[13px] font-medium text-black"
    >
      {PDP_POLICY_BADGE}
    </p>
  );
}

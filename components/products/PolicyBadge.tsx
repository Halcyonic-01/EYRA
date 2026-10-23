import { PDP_POLICY_BADGE } from "@/config/policy-copy";

/**
 * The return policy, in one line, on every product page. It stays in view as the
 * page scrolls (the whole product column is sticky on wide screens; on a phone
 * the badge itself sticks under the header). The text is fixed wording.
 */
export function PolicyBadge() {
  return (
    <p
      data-testid="policy-badge"
      className="sticky z-10 rounded-full border border-[#E1E1E1] bg-white px-4 py-2 text-center font-sans text-[13px] font-medium text-black"
      style={{ top: "calc(var(--header-offset) + 0.5rem)" }}
    >
      {PDP_POLICY_BADGE}
    </p>
  );
}

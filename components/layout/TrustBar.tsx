import { storeConfig } from "@/config/storeConfig";
/* ── Inline icons ─────────────────────────────────────────
   lucide-react v1.16 omits brand and seal icons, so these are hand-drawn
   paths sized to match the footer's existing 18px social icons. */

function HallmarkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14.5 7.5 22l4.5-2.5L16.5 22 15 14.5" />
      <path d="m10.2 9 1.3 1.3 2.6-2.6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ShieldTruckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.5 7.5 10 4.3-1.5 7.5-5.4 7.5-10v-6z" />
      <path d="M8.5 12h4v3.5h-4z" />
      <path d="M12.5 13.5h2l1 1.5v1h-3z" />
    </svg>
  );
}

const BADGES = [
  {
    icon: <HallmarkIcon />,
    title: "Certified 925 Sterling Silver",
    detail: `BIS hallmarked, Reg. No. ${storeConfig.company.bisRegistration}`,
  },
  {
    icon: <LockIcon />,
    title: "100% Secure Checkout",
    detail: "Powered by Razorpay",
  },
  {
    icon: <ShieldTruckIcon />,
    title: "Insured Express Delivery",
    detail: "Shipped via Shiprocket",
  },
];

/**
 * Accepted payment methods. Rendered as wordmark pills rather than brand
 * logos: we do not hold licensed logo assets, and an approximated Visa or
 * RuPay mark would be a trademark problem as well as a visual one.
 */
const PAYMENT_METHODS = ["UPI", "Visa", "Mastercard", "RuPay", "Net Banking"];

export function TrustBar() {
  return (
    <div className="border-t border-stone/40">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-10 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
          {BADGES.map((badge) => (
            <div key={badge.title} className="flex items-start gap-3">
              <span className="text-pearl shrink-0 mt-0.5">{badge.icon}</span>
              <div>
                <p className="font-sans font-medium text-[0.82rem] text-white leading-snug">
                  {badge.title}
                </p>
                <p className="font-sans font-normal text-[0.78rem] text-pearl leading-snug mt-0.5">
                  {badge.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <p className="font-sans font-semibold text-[0.68rem] tracking-[0.18em] uppercase text-pearl shrink-0">
            We accept
          </p>
          <ul className="flex flex-wrap items-center gap-2">
            {PAYMENT_METHODS.map((method) => (
              <li
                key={method}
                className="font-sans font-medium text-[0.76rem] text-white border border-pearl/50 rounded px-2.5 py-1 leading-none"
              >
                {method}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

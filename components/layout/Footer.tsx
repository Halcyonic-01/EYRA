import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ConsentSettingsLink } from "@/components/analytics/ConsentBanner";
import { NewsletterForm } from "./NewsletterForm";
import { BisMark } from "./BisMark";
import { TrustBar } from "./TrustBar";
import { COLLECTIONS } from "@/config/collections";
import { storeConfig } from "@/config/storeConfig";

const { contact, company, seller } = storeConfig;

// Built from the collections config so the footer can never link to a
// collection that does not exist.
const SHOP_LINKS = [
  ...COLLECTIONS.filter((c) =>
    ["rings", "pendants", "anklets", "bracelets"].includes(c.slug)
  ).map((c) => ({ label: c.label, href: `/collections/${c.slug}` })),
  { label: "All Collections", href: "/collections" },
  { label: "New Arrivals", href: "/new-arrivals" },
  { label: "Best Sellers", href: "/best-sellers" },
];

const SUPPORT_LINKS = [
  { label: "My Account", href: "/account" },
  { label: "My Wallet", href: "/wallet" },
  { label: "Track Your Order", href: "/orders" },
  { label: "Shipping & Delivery Policy", href: "/shipping-policy" },
  { label: "Returns, Exchanges & Refunds", href: "/refund-policy" },
  { label: "Jewelry Care & Sizing Chart", href: "/authenticity-and-care#care" },
  { label: "Contact Us", href: "/contact" },
];

const ABOUT_LINKS = [
  { label: "Our Story & Craftsmanship", href: "/craftsmanship" },
  { label: "925 Silver & Hallmarking", href: "/authenticity-and-care#purity" },
  { label: "Sustainability & Sourcing", href: "/sustainability" },
  { label: "Press Inquiries", href: "/contact#press" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
  { label: "Grievance Redressal", href: "/grievance-redressal" },
];

function NavColumn({
  heading,
  links,
}: {
  heading: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h3 className="text-[0.72rem] font-sans font-semibold tracking-[0.18em] uppercase text-white mb-6">
        {heading}
      </h3>
      <ul className="flex flex-col w-full">
        {links.map(({ label, href }) => (
          <li key={label + href} className="border-b border-stone/30 last:border-b-0">
            <Link
              href={href}
              className="block w-full py-3 text-[0.86rem] font-normal text-pearl hover:text-white transition-colors duration-200 tracking-[0.02em]"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-charcoal text-pearl" aria-label="Site footer">
      {/* ── Navigation columns ──────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-10">
          <NavColumn heading="Shop" links={SHOP_LINKS} />
          <NavColumn heading="Customer Care" links={SUPPORT_LINKS} />
          <NavColumn heading="About EYRA" links={ABOUT_LINKS} />

          {/* Stay connected */}
          <div>
            <h3 className="text-[0.72rem] font-sans font-semibold tracking-[0.18em] uppercase text-white mb-6">
              Stay Connected
            </h3>

            <p className="text-[0.86rem] font-normal leading-relaxed text-pearl mb-4 tracking-[0.02em]">
              Subscribe for exclusive drops and private sales.
            </p>
            <NewsletterForm />

            {/* Support shortcuts */}
            <div className="mt-6 flex flex-col gap-2">
              <a
                href={`mailto:${contact.supportEmail}`}
                className="text-[0.86rem] font-normal text-pearl hover:text-white transition-colors duration-200 tracking-[0.02em]"
              >
                {contact.supportEmail}
              </a>
              {contact.whatsapp && (
                <a
                  href={`https://wa.me/${contact.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.86rem] font-normal text-pearl hover:text-white transition-colors duration-200 tracking-[0.02em]"
                >
                  Chat on WhatsApp
                </a>
              )}
            </div>

            {/* Social links. lucide-react v1.16 omits brand icons; using SVG paths */}
            <div className="flex items-center gap-5 mt-6">
              <a
                href="https://www.instagram.com/eyra.org.in?stkn=MTFiZXYzazFzamJvYQ%3D%3D&utm_source=qr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="EYRA on Instagram"
                className="text-pearl hover:text-white transition-colors duration-200"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/company/eyrajewels"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="EYRA on LinkedIn"
                className="text-pearl hover:text-white transition-colors duration-200"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.75V21h-4v-5.6c0-1.34-.03-3.07-1.9-3.07-1.9 0-2.2 1.46-2.2 2.97V21H9z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Trust and security badges ───────────────────── */}
      <TrustBar />

      {/* ── Legal and corporate compliance ──────────────── */}
      <div className="border-t border-stone/40">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10 py-8 flex flex-col gap-6">

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {/* Brand + legal links */}
            <div className="flex flex-col gap-4">
              <Logo variant="light" size="md" />
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {LEGAL_LINKS.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-[0.78rem] font-normal text-pearl hover:text-white transition-colors duration-200 tracking-[0.02em]"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
                <ConsentSettingsLink className="text-[0.78rem] font-normal text-pearl hover:text-white transition-colors duration-200 tracking-[0.02em]" />
              </ul>
              <BisMark />
            </div>

            {/* Corporate registration details */}
            <address className="not-italic text-[0.76rem] font-normal leading-relaxed text-pearl tracking-[0.01em] lg:text-right">
              {seller.legalName}
              <br />
              Registered Office: {seller.addressLine1},{" "}
              {seller.addressLine2 && <>{seller.addressLine2}, </>}
              {seller.city}, {seller.state}, India {seller.pincode}
              <br />
              CIN: {company.cin}
              {seller.gstin && <> | GSTIN: {seller.gstin}</>}
              <br />
              BIS Hallmarking Registration No.: {company.bisRegistration}
              <br />
              Email:{" "}
              <a
                href={`mailto:${contact.adminEmail}`}
                className="text-pearl hover:text-white transition-colors duration-200"
              >
                {contact.adminEmail}
              </a>
            </address>
          </div>

          <div className="border-t border-stone/30 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[0.76rem] font-normal text-pearl tracking-[0.04em]">
              © {new Date().getFullYear()} {seller.legalName}. All rights reserved.
            </p>
            <p className="text-[0.76rem] font-normal text-pearl tracking-[0.04em]">
              Handcrafted in India
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

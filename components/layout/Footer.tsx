import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { NewsletterForm } from "./NewsletterForm";
import { TrustBar } from "./TrustBar";
import { COLLECTIONS } from "@/config/collections";
import { storeConfig } from "@/config/storeConfig";

const { contact, company, seller } = storeConfig;

// Built from the collections config so the footer can never link to a
// collection that does not exist.
const SHOP_LINKS = [
  ...COLLECTIONS.filter((c) =>
    ["rings", "necklaces", "anklets", "bracelets"].includes(c.slug)
  ).map((c) => ({ label: c.label, href: `/collections/${c.slug}` })),
  { label: "New Arrivals", href: "/new-arrivals" },
  { label: "Best Sellers", href: "/best-sellers" },
];

const SUPPORT_LINKS = [
  { label: "Track Your Order", href: "/orders" },
  { label: "Shipping & Delivery Policy", href: "/shipping-policy" },
  { label: "Returns, Exchanges & Refunds", href: "/refund-policy" },
  { label: "Jewelry Care & Sizing Chart", href: "/authenticity-and-care" },
  { label: "Contact Us", href: "/contact" },
];

const ABOUT_LINKS = [
  { label: "Our Story & Craftsmanship", href: "/craftsmanship" },
  { label: "925 Silver & Hallmarking", href: "/authenticity-and-care" },
  { label: "Sustainability & Sourcing", href: "/sustainability" },
  { label: "Press Inquiries", href: "/contact" },
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
      <ul className="flex flex-col gap-3.5">
        {links.map(({ label, href }) => (
          <li key={label + href}>
            <Link
              href={href}
              className="text-[0.86rem] font-normal text-pearl hover:text-white transition-colors duration-200 tracking-[0.02em]"
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
                href="https://instagram.com/eyrajewelry"
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
                href="https://www.linkedin.com/company/eyrajewelry"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="EYRA on LinkedIn"
                className="text-pearl hover:text-white transition-colors duration-200"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.75V21h-4v-5.6c0-1.34-.03-3.07-1.9-3.07-1.9 0-2.2 1.46-2.2 2.97V21H9z" />
                </svg>
              </a>
              <a
                href="https://pinterest.com/eyrajewelry"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="EYRA on Pinterest"
                className="text-pearl hover:text-white transition-colors duration-200"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.236 2.636 7.855 6.356 9.312-.088-.791-.167-2.005.035-2.868.181-.78 1.172-4.97 1.172-4.97s-.299-.598-.299-1.482c0-1.388.806-2.428 1.808-2.428.852 0 1.264.64 1.264 1.408 0 .858-.546 2.141-.828 3.33-.236.995.499 1.806 1.476 1.806 1.771 0 3.133-1.867 3.133-4.562 0-2.387-1.715-4.057-4.163-4.057-2.836 0-4.5 2.127-4.5 4.326 0 .856.33 1.773.741 2.274a.3.3 0 0 1 .069.286c-.076.31-.244.995-.277 1.134-.044.183-.146.222-.337.134-1.249-.581-2.03-2.407-2.03-3.874 0-3.154 2.292-6.052 6.608-6.052 3.469 0 6.165 2.473 6.165 5.776 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.966-.527-2.292-1.148l-.623 2.378c-.226.869-.835 1.958-1.244 2.621.937.29 1.931.446 2.962.446 5.523 0 10-4.477 10-10S17.523 2 12 2z" />
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
              </ul>
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

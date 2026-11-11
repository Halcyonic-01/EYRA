import type { ReactNode } from "react";

/** Centred eyebrow, heading and lead text that opens a section on editorial pages. */
export function SectionIntro({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-w-[640px] mx-auto text-center ${className}`}>
      {eyebrow && (
        <p className="font-sans font-normal text-[0.7rem] tracking-[0.28em] uppercase text-[#909090] mb-4">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display font-light italic text-[clamp(1.85rem,3.5vw,2.75rem)] leading-[1.15] text-black [text-wrap:balance]">
        {title}
      </h2>
      {children && (
        <p className="font-sans font-light text-[16px] leading-[27px] text-[#505050] mt-4 [text-wrap:pretty]">
          {children}
        </p>
      )}
    </div>
  );
}

/** Row of in-page jump links shown under a page header. */
export function JumpLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="max-w-screen-xl mx-auto px-6 lg:px-10 mt-8">
      <ul className="flex flex-wrap justify-center gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="inline-block rounded-full border border-[#CFCFCF] px-5 py-2 font-sans font-normal text-[13px] text-black hover:bg-black hover:text-white hover:border-black transition-colors duration-200"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Keeps anchored sections clear of the fixed header. */
export const ANCHOR_OFFSET = { scrollMarginTop: "calc(var(--header-offset) + 1rem)" } as const;

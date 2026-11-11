import { isValidElement, type ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "./PageHeader";

const LINK = "text-black underline underline-offset-4 decoration-[#B0B0B0] hover:decoration-black transition-colors duration-200";

/** Inline link for policy text: mailto and anchors stay plain anchors, pages use Link. */
export function TextLink({ href, children }: { href: string; children?: ReactNode }) {
  if (href.startsWith("mailto:") || href.startsWith("#")) {
    return (
      <a href={href} className={LINK}>
        {children ?? href.replace("mailto:", "")}
      </a>
    );
  }
  return (
    <Link href={href} className={LINK}>
      {children}
    </Link>
  );
}

/** A plain string or inline JSX renders as a paragraph. */
type Paragraph = string | ReactNode;

export type LegalBlock =
  | Paragraph
  | { kind: "list"; items: ReactNode[] }
  | { kind: "steps"; items: { title: string; body: ReactNode }[] }
  | { kind: "details"; items: { label: string; value: ReactNode }[] }
  | { kind: "note"; title?: string; body: ReactNode; tone?: "neutral" | "important" }
  | { kind: "cards"; items: { title: string; body: ReactNode }[] }
  | { kind: "example"; title: string; rows: { label: string; value: string }[]; total: { label: string; value: string } };

export interface LegalSection {
  /** Anchor for the page index and deep links, e.g. "exchanges". */
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface Highlight {
  label: string;
  value: string;
  note?: string;
}

const TEXT = "font-sans font-light text-[16px] leading-[27px] text-[#505050]";

function isStructured(block: LegalBlock): block is Exclude<LegalBlock, Paragraph> {
  return (
    typeof block === "object" &&
    block !== null &&
    !isValidElement(block) &&
    "kind" in (block as object)
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (!isStructured(block)) {
    return <p className={TEXT}>{block}</p>;
  }

  switch (block.kind) {
    case "list":
      return (
        <ul className="flex flex-col gap-3">
          {block.items.map((item, i) => (
            <li key={i} className={`${TEXT} relative pl-6`}>
              <span aria-hidden="true" className="absolute left-0 top-[12px] w-2 h-px bg-[#909090]" />
              {item}
            </li>
          ))}
        </ul>
      );

    case "steps":
      return (
        <ol className="flex flex-col">
          {block.items.map((step, i) => (
            <li key={step.title} className="relative flex gap-5 pb-6 last:pb-0">
              {i < block.items.length - 1 && (
                <span aria-hidden="true" className="absolute left-[15px] top-9 bottom-1 w-px bg-[#E2E2E2]" />
              )}
              <span className="shrink-0 w-8 h-8 rounded-full border border-[#CFCFCF] bg-white flex items-center justify-center font-sans text-[13px] text-black tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 pt-[3px]">
                <p className="font-sans font-medium text-[16px] leading-[26px] text-black">{step.title}</p>
                <p className={`${TEXT} mt-1`}>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      );

    case "details":
      return (
        <dl className="border border-[#E2E2E2] bg-white divide-y divide-[#EEEEEE]">
          {block.items.map((item) => (
            <div key={item.label} className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-6 px-5 py-4">
              <dt className="font-sans font-normal text-[14px] leading-[25px] text-[#909090]">{item.label}</dt>
              <dd className="font-sans font-normal text-[15px] leading-[25px] text-black min-w-0 break-words">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      );

    case "note":
      return (
        <div
          className={`border-l-2 px-5 py-4 ${
            block.tone === "important" ? "border-black bg-[#F4F4F4]" : "border-[#CFCFCF] bg-ivory"
          }`}
        >
          {block.title && (
            <p className="font-sans font-medium text-[15px] leading-[24px] text-black mb-1">{block.title}</p>
          )}
          <p className="font-sans font-light text-[15px] leading-[25px] text-[#505050]">{block.body}</p>
        </div>
      );

    case "cards":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:[&>*:last-child:nth-child(odd)]:col-span-2">
          {block.items.map((card) => (
            <div key={card.title} className="border border-[#E2E2E2] bg-white p-5">
              <p className="font-sans font-medium text-[15px] leading-[24px] text-black mb-2">{card.title}</p>
              <p className="font-sans font-light text-[15px] leading-[25px] text-[#505050]">{card.body}</p>
            </div>
          ))}
        </div>
      );

    case "example":
      return (
        <figure className="border border-[#E2E2E2] bg-white">
          <figcaption className="px-5 pt-4 pb-3 font-sans font-normal text-[0.72rem] tracking-[0.16em] uppercase text-[#909090]">
            {block.title}
          </figcaption>
          <dl className="px-5">
            {block.rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4 py-2 border-t border-[#EEEEEE]">
                <dt className="font-sans font-light text-[15px] text-[#505050]">{row.label}</dt>
                <dd className="font-sans font-normal text-[15px] text-black tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex justify-between gap-4 px-5 py-3 mt-1 bg-ivory border-t border-[#E2E2E2]">
            <span className="font-sans font-medium text-[15px] text-black">{block.total.label}</span>
            <span className="font-sans font-medium text-[15px] text-black tabular-nums">{block.total.value}</span>
          </div>
        </figure>
      );
  }
}

function PageIndex({ sections }: { sections: LegalSection[] }) {
  return (
    <ol className="flex flex-col">
      {sections.map((section, i) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="group flex gap-3 py-2 font-sans font-light text-[14px] leading-[21px] text-[#626262] hover:text-black transition-colors duration-200"
          >
            <span className="tabular-nums text-[#B0B0B0] group-hover:text-black transition-colors duration-200">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{section.heading}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * Shared shell for the policy pages (Privacy, Terms, Shipping, Returns,
 * Grievance), so they stay typographically identical and only content differs.
 */
export function LegalDocument({
  title,
  standfirst,
  updated,
  sections,
  eyebrow,
  highlights,
  help,
}: {
  title: string;
  standfirst: string;
  /** Human readable last-reviewed date, e.g. "August 2026". */
  updated: string;
  sections: LegalSection[];
  eyebrow?: string;
  /** Key terms shown as cards under the header. */
  highlights?: Highlight[];
  /** Closing contact panel. */
  help?: { title: string; body: ReactNode };
}) {
  return (
    <>
      <section className="bg-white pb-12 lg:pb-16">
        <PageHeader title={title} standfirst={standfirst} eyebrow={eyebrow} align="center" />
        <p className="text-center font-sans font-light text-[0.8rem] tracking-[0.04em] text-[#909090] mt-6 px-6">
          Last updated {updated}
        </p>

        {highlights && highlights.length > 0 && (
          <div className="max-w-screen-xl mx-auto px-6 lg:px-10 mt-12">
            <ul
              className={`grid grid-cols-1 gap-px bg-[#E2E2E2] border border-[#E2E2E2] ${
                highlights.length >= 4
                  ? "grid-cols-2 lg:grid-cols-4"
                  : highlights.length === 3
                    ? "sm:grid-cols-3"
                    : "grid-cols-2 max-w-[760px] mx-auto"
              }`}
            >
              {highlights.map((item) => (
                <li key={item.label} className="bg-ivory px-3 sm:px-6 py-6 sm:py-7 text-center flex flex-col items-center gap-2">
                  <p className="font-sans font-normal text-[0.64rem] sm:text-[0.68rem] tracking-[0.2em] uppercase text-[#909090]">
                    {item.label}
                  </p>
                  <p className="font-display font-light italic text-[1.6rem] sm:text-[1.9rem] leading-[1.1] text-black">
                    {item.value}
                  </p>
                  {item.note && (
                    <p className="font-sans font-light text-[12px] sm:text-[13px] leading-[18px] sm:leading-[20px] text-[#626262] max-w-[240px]">
                      {item.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="bg-white pb-20 lg:pb-28 border-t border-[#EEEEEE]">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-10 pt-10 lg:pt-16">
          <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-10 lg:gap-16 xl:gap-24">
            {/* Index: collapsible on small screens, sticky alongside the text on large */}
            <nav aria-label="On this page" className="lg:order-none">
              <details className="lg:hidden border border-[#E2E2E2] bg-ivory group">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-sans font-normal text-[0.72rem] tracking-[0.2em] uppercase text-black">
                  On this page
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="transition-transform duration-200 group-open:rotate-180">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <div className="px-5 pb-4 border-t border-[#E2E2E2] pt-2">
                  <PageIndex sections={sections} />
                </div>
              </details>

              <div className="hidden lg:block sticky" style={{ top: "calc(var(--header-offset) + 2rem)" }}>
                <p className="font-sans font-normal text-[0.7rem] tracking-[0.22em] uppercase text-black mb-3">
                  On this page
                </p>
                <PageIndex sections={sections} />
              </div>
            </nav>

            <div className="min-w-0 max-w-[760px]">
              {sections.map((section, i) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="pt-10 first:pt-0 pb-10 border-b border-[#EEEEEE] last:border-b-0"
                  style={{ scrollMarginTop: "calc(var(--header-offset) + 1.5rem)" }}
                >
                  <p className="font-sans font-normal text-[0.7rem] tracking-[0.24em] uppercase text-[#909090] mb-2 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h2 className="font-display font-light italic text-[clamp(1.6rem,3vw,2.1rem)] leading-[1.15] text-black mb-5 [text-wrap:balance]">
                    {section.heading}
                  </h2>
                  <div className="flex flex-col gap-5">
                    {section.blocks.map((block, j) => (
                      <Block key={j} block={block} />
                    ))}
                  </div>
                </article>
              ))}

              {help && (
                <aside className="mt-6 bg-charcoal text-white px-6 sm:px-8 py-8 text-center flex flex-col items-center gap-3">
                  <p className="font-display font-light italic text-[1.75rem] leading-[1.15]">{help.title}</p>
                  <p className="font-sans font-light text-[15px] leading-[25px] text-[#E2E2E2] max-w-[520px] [&_a]:text-white [&_a]:underline [&_a]:underline-offset-4">
                    {help.body}
                  </p>
                </aside>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

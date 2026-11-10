import { PageHeader } from "./PageHeader";

export interface LegalSection {
  heading: string;
  /** Each entry renders as its own paragraph. */
  body: string[];
  /** Optional bullet list rendered after the paragraphs. */
  bullets?: string[];
}

/**
 * Shared shell for the four policy documents, so Privacy, Terms, Shipping, and
 * Returns stay typographically identical and only their content differs.
 */
export function LegalDocument({
  title,
  standfirst,
  updated,
  sections,
  eyebrow,
}: {
  title: string;
  standfirst: string;
  /** Human readable last-reviewed date, e.g. "August 2026". */
  updated: string;
  sections: LegalSection[];
  eyebrow?: string;
}) {
  return (
    <section className="bg-white pb-20">
      <PageHeader
        title={title}
        standfirst={standfirst}
        eyebrow={eyebrow}
      />

      <div className="max-w-screen-xl mx-auto px-6 lg:px-10">
        <p className="font-sans font-light text-[0.82rem] text-[#909090] mt-6 mb-12">
          Last updated {updated}
        </p>

        <div className="max-w-[760px] flex flex-col gap-10">
          {sections.map((section) => (
            <div key={section.heading}>
              <h2 className="font-sans font-medium text-[18px] leading-[27px] text-black mb-4">
                {section.heading}
              </h2>
              <div className="flex flex-col gap-4">
                {section.body.map((paragraph, i) => (
                  <p
                    key={i}
                    className="font-sans font-light text-[16px] leading-[26px] text-[#505050]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
              {section.bullets && (
                <ul className="mt-4 flex flex-col gap-2 list-disc pl-5">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="font-sans font-light text-[16px] leading-[26px] text-[#505050]"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

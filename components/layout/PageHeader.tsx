/**
 * Title and standfirst shared by every editorial and legal page.
 */
export function PageHeader({
  title,
  standfirst,
  eyebrow,
}: {
  title: string;
  standfirst?: string;
  eyebrow?: string;
}) {
  return (
    <div className="max-w-screen-xl mx-auto px-6 lg:px-10 pt-10">
      <div className="max-w-[640px]">
        {eyebrow && (
          <p className="font-sans font-normal text-[0.7rem] tracking-[0.28em] uppercase text-[#909090] mb-4">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display font-light italic text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.1] text-black">
          {title}
        </h1>
        {standfirst && (
          <p className="font-sans font-light text-[18px] leading-[27px] text-[#505050] mt-4">
            {standfirst}
          </p>
        )}
      </div>
    </div>
  );
}

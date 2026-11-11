/**
 * Title and standfirst shared by every editorial and legal page.
 */
export function PageHeader({
  title,
  standfirst,
  eyebrow,
  align = "left",
}: {
  title: string;
  standfirst?: string;
  eyebrow?: string;
  align?: "left" | "center";
}) {
  const centered = align === "center";
  return (
    <div className="max-w-screen-xl mx-auto px-6 lg:px-10 pt-10 lg:pt-14">
      <div className={centered ? "max-w-[720px] mx-auto text-center" : "max-w-[640px]"}>
        {eyebrow && (
          <p className="font-sans font-normal text-[0.7rem] tracking-[0.28em] uppercase text-[#909090] mb-4">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display font-light italic text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.1] text-black [text-wrap:balance]">
          {title}
        </h1>
        {centered && <span aria-hidden="true" className="block w-10 h-px bg-[#CFCFCF] mx-auto mt-6" />}
        {standfirst && (
          <p
            className={`font-sans font-light text-[17px] sm:text-[18px] leading-[28px] text-[#505050] [text-wrap:pretty] ${
              centered ? "mt-6" : "mt-4"
            }`}
          >
            {standfirst}
          </p>
        )}
      </div>
    </div>
  );
}

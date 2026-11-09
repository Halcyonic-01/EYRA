import { FadeIn } from "@/components/ui/FadeIn";

const VALUES = [
  {
    title: "Uncompromised Purity",
    body: "Certified 925 sterling silver hallmarked for absolute authenticity and lasting brilliance.",
  },
  {
    title: "Everyday Durability",
    body: "Advanced anti-tarnish and water-resistant engineering designed for your daily routine.",
  },
  {
    title: "Mindful Craftsmanship",
    body: "Sustainably produced luxury jewelry that honors ethical practices and environmental responsibility.",
  },
  {
    title: "Modern Expression",
    body: "Contemporary minimalism meeting classic silhouettes to empower your unique personal style.",
  },
];

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-jet flex-shrink-0">
      <path
        d="M9 0L10.06 6.83L16.5 9L10.06 11.17L9 18L7.94 11.17L1.5 9L7.94 6.83L9 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ValuesSection() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-16">

        {/* Section header */}
        <FadeIn className="mb-16 text-center">
          <p className="font-sans font-light tracking-[0.3em] uppercase text-[0.8rem] text-jet">
            OUR VALUES
          </p>
        </FadeIn>

        {/* 2 x 2 grid: two values per row at every screen size */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:gap-x-10 lg:gap-x-14 max-w-3xl mx-auto">
          {VALUES.map((v, i) => (
            <FadeIn key={v.title} delay={i * 80} className="flex flex-col items-center text-center gap-4">
              <StarIcon />
              <p className="font-sans font-medium text-[0.7rem] sm:text-[0.78rem] tracking-[0.12em] uppercase text-jet">
                {v.title}
              </p>
              <p className="font-sans font-light text-[0.75rem] sm:text-[0.82rem] leading-relaxed text-carbon">
                {v.body}
              </p>
            </FadeIn>
          ))}
        </div>

      </div>
    </section>
  );
}

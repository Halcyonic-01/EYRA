import Image from "next/image";
import Link from "next/link";

const PANELS = [
  {
    src: "/images/for-her.jpg",
    tag: "FOR HER",
    description:
      "From delicate rings to bold statement pendants, every piece is designed to make women feel effortlessly beautiful with contemporary minimal style.",
    href: "/collections/for-her",
  },
  {
    src: "/images/for-him.jpg",
    tag: "FOR HIM",
    description:
      "Crafted with clean lines and structured silhouettes, making every look feel bold, modern, and effortlessly timeless.",
    href: "/collections/for-him",
  },
];

export function GenderSplit() {
  return (
    <section className="bg-white py-6 sm:py-10">
      <div className="px-3 sm:px-6 lg:px-16">
        <p className="mb-5 sm:mb-8 text-center font-display italic font-light leading-[1.05] text-[clamp(1.8rem,4vw,3rem)] text-jet">
          Shop by Category
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 px-3 sm:gap-6 sm:px-6 lg:px-16">
        {PANELS.map((panel) => (
          <Link
            key={panel.tag}
            href={panel.href}
            aria-label={`Shop ${panel.tag}`}
            className="group relative block overflow-hidden rounded-2xl ring-1 ring-black/5 shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
            style={{ height: "clamp(280px, 60vw, 680px)" }}
          >
            <Image
              src={panel.src}
              alt={panel.tag}
              fill
              className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, 50vw"
            />
            {/* Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

            {/* Content overlay */}
            <div className="absolute bottom-5 left-3 right-3 sm:bottom-10 sm:left-8 sm:right-auto lg:left-12 max-w-[240px] lg:max-w-[280px]">
              <p className="font-sans font-semibold text-[0.6rem] sm:text-[0.7rem] tracking-[0.2em] sm:tracking-[0.3em] uppercase text-white/80 mb-2 sm:mb-3">
                {panel.tag}
              </p>
              <p className="hidden sm:block font-sans font-light text-[0.82rem] leading-relaxed text-white/80 mb-5">
                {panel.description}
              </p>
              <span className="text-[0.72rem] font-sans font-light tracking-[0.2em] uppercase text-white border-b border-white/60 pb-px group-hover:border-white transition-colors duration-300">
                Shop Now
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

import Image from "next/image";
import Link from "next/link";

const PANELS = [
  {
    src: "/images/for-her.jpg",
    tag: "FOR HER",
    description:
      "From delicate rings to bold statement necklaces, every piece is designed to make women feel effortlessly beautiful with contemporary minimal style.",
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
    <section className="bg-white">
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {PANELS.map((panel) => (
          <div
            key={panel.tag}
            className="group relative overflow-hidden"
            style={{ height: "clamp(400px, 55vw, 680px)" }}
          >
            <Image
              src={panel.src}
              alt={panel.tag}
              fill
              className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
            {/* Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

            {/* Content overlay */}
            <div className="absolute bottom-10 left-8 lg:left-12 max-w-[240px] lg:max-w-[280px]">
              <p className="font-sans font-semibold text-[0.7rem] tracking-[0.3em] uppercase text-white/80 mb-3">
                {panel.tag}
              </p>
              <p className="font-sans font-light text-[0.82rem] leading-relaxed text-white/80 mb-5">
                {panel.description}
              </p>
              <Link
                href={panel.href}
                className="text-[0.72rem] font-sans font-light tracking-[0.2em] uppercase text-white border-b border-white/60 pb-px hover:border-white transition-colors duration-300"
              >
                Shop Now
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
